import { z } from "zod";

export const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/i, "expected sha256 hex digest");

export const LoopDecisionSchema = z.enum(["certified", "acceptable", "rejected"]);
export type LoopDecision = z.infer<typeof LoopDecisionSchema>;

export const LoopSourceSchema = z.object({
  kind: z.enum(["upload", "generated"]),
  digest: DigestSchema,
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  providerId: z.string().min(1).optional(),
  providerModelRevision: z.string().min(1).optional(),
});
export type LoopSource = z.infer<typeof LoopSourceSchema>;

export const LoopMotionPlanSchema = z.object({
  recipe: z.enum([
    "ambient_drift",
    "subtle_orbit",
    "breathing_idle",
    "cloth_hair_sway",
    "rain_smoke_steam",
    "particle_circulation",
    "light_shadow_drift",
    "water_reflection",
    "shallow_parallax",
    "custom",
  ]),
  prompt: z.string().min(1).max(8_000),
  negativePrompt: z.string().max(4_000).optional(),
  strength: z.number().min(0).max(1).default(0.5),
  digest: DigestSchema,
});
export type LoopMotionPlan = z.infer<typeof LoopMotionPlanSchema>;

export const LoopGenerationRequestSchema = z.object({
  schemaVersion: z.literal("loop-generation/v1"),
  projectId: z.string().min(1),
  requestId: z.string().min(1),
  source: LoopSourceSchema,
  motionPlan: LoopMotionPlanSchema,
  requestedDurationMs: z.number().int().min(3_000).max(15_000),
  width: z.number().int().min(256).max(7_680),
  height: z.number().int().min(256).max(7_680),
  startEndStrategy: z.enum(["same_frame", "conditioned_end", "generated_end"]),
  maxRetries: z.number().int().min(0).max(5).default(2),
});
export type LoopGenerationRequest = z.infer<typeof LoopGenerationRequestSchema>;

export const LoopSeamMetricSchema = z.object({
  name: z.enum(["frame_similarity", "structural_similarity", "motion_continuity", "perceptual_similarity"]),
  score: z.number().min(0).max(1),
  weight: z.number().positive().max(10).default(1),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type LoopSeamMetric = z.infer<typeof LoopSeamMetricSchema>;

export const LoopRepairOperationSchema = z.object({
  type: z.enum(["regenerate", "same_frame_end", "trim", "crossfade", "interpolate"]),
  reason: z.string().min(1),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type LoopRepairOperation = z.infer<typeof LoopRepairOperationSchema>;

export const LoopGenerationAttemptSchema = z.object({
  attemptId: z.string().min(1),
  attemptNumber: z.number().int().positive(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  providerId: z.string().min(1),
  providerModelRevision: z.string().min(1).optional(),
  artifactDigest: DigestSchema.optional(),
  observedDurationMs: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  seamMetrics: z.array(LoopSeamMetricSchema).default([]),
  repairOperations: z.array(LoopRepairOperationSchema).default([]),
  failureCode: z.string().min(1).optional(),
});
export type LoopGenerationAttempt = z.infer<typeof LoopGenerationAttemptSchema>;

export const LoopReceiptSchema = z.object({
  schemaVersion: z.literal("loop-receipt/v1"),
  projectId: z.string().min(1),
  requestId: z.string().min(1),
  attemptId: z.string().min(1),
  sourceDigest: DigestSchema,
  motionPlanDigest: DigestSchema,
  providerId: z.string().min(1),
  providerModelRevision: z.string().min(1).optional(),
  requestedDurationMs: z.number().int().positive(),
  observedDurationMs: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  startEndStrategy: z.enum(["same_frame", "conditioned_end", "generated_end"]),
  artifactDigest: DigestSchema,
  seamPolicyVersion: z.string().min(1),
  seamMetrics: z.array(LoopSeamMetricSchema).min(1),
  repairOperations: z.array(LoopRepairOperationSchema),
  retryCount: z.number().int().nonnegative(),
  retryReasons: z.array(z.string().min(1)),
  decision: LoopDecisionSchema,
  createdAt: z.string().datetime(),
});
export type LoopReceipt = z.infer<typeof LoopReceiptSchema>;

export interface LoopProviderAdapter {
  readonly id: string;
  generate(request: LoopGenerationRequest, attemptNumber: number, signal?: AbortSignal): Promise<LoopGenerationAttempt>;
}
