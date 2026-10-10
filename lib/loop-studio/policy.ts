import {
  LoopGenerationAttemptSchema,
  LoopGenerationRequestSchema,
  LoopReceiptSchema,
  type LoopDecision,
  type LoopGenerationAttempt,
  type LoopGenerationRequest,
  type LoopReceipt,
  type LoopSeamMetric,
} from "./contracts";

export type SeamPolicy = Readonly<{
  version: string;
  certifiedMin: number;
  acceptableMin: number;
  requiredMetrics: readonly LoopSeamMetric["name"][];
}>;

export const DEFAULT_SEAM_POLICY: SeamPolicy = Object.freeze({
  version: "loop-seam/v1",
  certifiedMin: 0.95,
  acceptableMin: 0.86,
  requiredMetrics: ["frame_similarity", "motion_continuity"],
});

export type SeamEvaluation = Readonly<{
  decision: LoopDecision;
  score: number;
  reasons: readonly string[];
}>;

export function evaluateSeam(
  metrics: readonly LoopSeamMetric[],
  policy: SeamPolicy = DEFAULT_SEAM_POLICY,
): SeamEvaluation {
  const byName = new Map(metrics.map((metric) => [metric.name, metric]));
  const missing = policy.requiredMetrics.filter((name) => !byName.has(name));

  if (missing.length > 0) {
    return Object.freeze({
      decision: "rejected",
      score: 0,
      reasons: [`missing required seam metrics: ${missing.join(", ")}`],
    });
  }

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return Object.freeze({
      decision: "rejected",
      score: 0,
      reasons: ["invalid seam metric weights"],
    });
  }

  const weightedScore = metrics.reduce((sum, metric) => sum + metric.score * metric.weight, 0) / totalWeight;
  const score = Math.round(weightedScore * 10_000) / 10_000;

  if (score >= policy.certifiedMin) {
    return Object.freeze({ decision: "certified", score, reasons: [] });
  }

  if (score >= policy.acceptableMin) {
    return Object.freeze({
      decision: "acceptable",
      score,
      reasons: [`score ${score} is below certified threshold ${policy.certifiedMin}`],
    });
  }

  return Object.freeze({
    decision: "rejected",
    score,
    reasons: [`score ${score} is below acceptable threshold ${policy.acceptableMin}`],
  });
}

export type RetryDecision = Readonly<{
  action: "accept" | "retry" | "stop";
  reason: string;
}>;

export function decideNextAction(
  requestInput: LoopGenerationRequest,
  attemptInput: LoopGenerationAttempt,
  policy: SeamPolicy = DEFAULT_SEAM_POLICY,
): RetryDecision {
  const request = LoopGenerationRequestSchema.parse(requestInput);
  const attempt = LoopGenerationAttemptSchema.parse(attemptInput);

  if (attempt.status === "cancelled") {
    return Object.freeze({ action: "stop", reason: "attempt cancelled" });
  }

  if (attempt.status === "failed") {
    if (attempt.attemptNumber <= request.maxRetries) {
      return Object.freeze({ action: "retry", reason: attempt.failureCode ?? "provider failure" });
    }
    return Object.freeze({ action: "stop", reason: "retry budget exhausted after provider failure" });
  }

  if (attempt.status !== "completed") {
    return Object.freeze({ action: "stop", reason: `attempt is not terminal: ${attempt.status}` });
  }

  if (!attempt.artifactDigest || !attempt.observedDurationMs || !attempt.fps) {
    return Object.freeze({ action: "stop", reason: "completed attempt is missing required artifact metadata" });
  }

  const evaluation = evaluateSeam(attempt.seamMetrics, policy);
  if (evaluation.decision !== "rejected") {
    return Object.freeze({ action: "accept", reason: evaluation.decision });
  }

  if (attempt.attemptNumber <= request.maxRetries) {
    return Object.freeze({ action: "retry", reason: evaluation.reasons.join("; ") });
  }

  return Object.freeze({ action: "stop", reason: "retry budget exhausted after seam rejection" });
}

export type ReceiptInput = Readonly<{
  request: LoopGenerationRequest;
  attempt: LoopGenerationAttempt;
  retryReasons?: readonly string[];
  createdAt: string;
  policy?: SeamPolicy;
}>;

export function buildLoopReceipt(input: ReceiptInput): Readonly<LoopReceipt> {
  const request = LoopGenerationRequestSchema.parse(input.request);
  const attempt = LoopGenerationAttemptSchema.parse(input.attempt);
  const policy = input.policy ?? DEFAULT_SEAM_POLICY;

  if (attempt.status !== "completed") {
    throw new Error(`cannot build receipt for non-completed attempt: ${attempt.status}`);
  }
  if (!attempt.artifactDigest || !attempt.observedDurationMs || !attempt.fps) {
    throw new Error("cannot build receipt without artifact digest, observed duration, and fps");
  }

  const evaluation = evaluateSeam(attempt.seamMetrics, policy);

  const receipt = LoopReceiptSchema.parse({
    schemaVersion: "loop-receipt/v1",
    projectId: request.projectId,
    requestId: request.requestId,
    attemptId: attempt.attemptId,
    sourceDigest: request.source.digest,
    motionPlanDigest: request.motionPlan.digest,
    providerId: attempt.providerId,
    providerModelRevision: attempt.providerModelRevision,
    requestedDurationMs: request.requestedDurationMs,
    observedDurationMs: attempt.observedDurationMs,
    fps: attempt.fps,
    width: request.width,
    height: request.height,
    startEndStrategy: request.startEndStrategy,
    artifactDigest: attempt.artifactDigest,
    seamPolicyVersion: policy.version,
    seamMetrics: attempt.seamMetrics,
    repairOperations: attempt.repairOperations,
    retryCount: Math.max(0, attempt.attemptNumber - 1),
    retryReasons: [...(input.retryReasons ?? [])],
    decision: evaluation.decision,
    createdAt: input.createdAt,
  });

  return Object.freeze(receipt);
}
