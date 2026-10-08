import { createHash } from "node:crypto";

import type {
  CompiledWorkflowArtifacts,
  GuideDocument,
  ReviewState,
  StepGraph,
  TranscriptSegment,
  VideoPlan,
  VisualEvidenceRef,
  WorkflowCapture,
  WorkflowEvent,
  WorkflowStep,
} from "./schema";

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForHash(entry)]),
    );
  }

  return value;
}

export function stableHash(value: unknown): string {
  const canonical = JSON.stringify(normalizeForHash(value));
  return createHash("sha256").update(canonical).digest("hex");
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} must not be empty`);
  }
}

function assertFiniteRange(value: number, field: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
}

function uniqueById<T extends { id: string }>(items: T[], field: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    requireNonEmpty(item.id, `${field}.id`);
    if (seen.has(item.id)) {
      throw new Error(`${field} contains duplicate id: ${item.id}`);
    }
    seen.add(item.id);
  }
}

function validateTranscript(segments: TranscriptSegment[], durationMs: number): void {
  uniqueById(segments, "transcript");
  for (const segment of segments) {
    assertFiniteRange(segment.startMs, `transcript.${segment.id}.startMs`, 0, durationMs);
    assertFiniteRange(segment.endMs, `transcript.${segment.id}.endMs`, segment.startMs, durationMs);
    requireNonEmpty(segment.text, `transcript.${segment.id}.text`);
  }
}

function validateEvidence(evidence: VisualEvidenceRef[], durationMs: number): void {
  uniqueById(evidence, "evidence");
  for (const item of evidence) {
    requireNonEmpty(item.uri, `evidence.${item.id}.uri`);
    assertFiniteRange(item.capturedAtMs, `evidence.${item.id}.capturedAtMs`, 0, durationMs);
  }
}

function validateEvents(
  events: WorkflowEvent[],
  durationMs: number,
  evidenceIds: Set<string>,
): void {
  uniqueById(events, "events");
  for (const event of events) {
    requireNonEmpty(event.label, `events.${event.id}.label`);
    assertFiniteRange(event.atMs, `events.${event.id}.atMs`, 0, durationMs);
    for (const evidenceRef of event.evidenceRefs ?? []) {
      if (!evidenceIds.has(evidenceRef)) {
        throw new Error(`events.${event.id} references missing evidence: ${evidenceRef}`);
      }
    }
  }
}

function normalizedCapture(capture: WorkflowCapture): WorkflowCapture {
  requireNonEmpty(capture.workspaceId, "workspaceId");
  requireNonEmpty(capture.workflowId, "workflowId");
  requireNonEmpty(capture.captureId, "captureId");

  if (!Number.isFinite(capture.durationMs) || capture.durationMs < 0) {
    throw new Error("durationMs must be a finite non-negative number");
  }

  const evidence = [...(capture.evidence ?? [])].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const transcript = [...(capture.transcript ?? [])].sort(
    (left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id),
  );
  const events = [...capture.events].sort(
    (left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id),
  );

  validateEvidence(evidence, capture.durationMs);
  validateTranscript(transcript, capture.durationMs);
  validateEvents(events, capture.durationMs, new Set(evidence.map((item) => item.id)));

  return {
    ...capture,
    events,
    transcript,
    evidence,
  };
}

function narrationFor(event: WorkflowEvent, transcript: TranscriptSegment[]): string {
  const containing = transcript.find(
    (segment) => segment.startMs <= event.atMs && segment.endMs >= event.atMs,
  );
  return containing?.text.trim() || event.label.trim();
}

function reviewStateFor(
  event: WorkflowEvent,
  evidenceById: Map<string, VisualEvidenceRef>,
): ReviewState {
  if (event.sensitive) {
    return "BLOCKED_REVIEW";
  }

  const hasSensitiveEvidence = (event.evidenceRefs ?? []).some(
    (ref) => evidenceById.get(ref)?.sensitive,
  );
  return hasSensitiveEvidence ? "BLOCKED_REVIEW" : "READY";
}

function compileSteps(capture: WorkflowCapture): WorkflowStep[] {
  const evidenceById = new Map((capture.evidence ?? []).map((item) => [item.id, item]));
  const transcript = capture.transcript ?? [];

  return capture.events.map((event, index) => {
    const nextEvent = capture.events[index + 1];
    const endMs = nextEvent?.atMs ?? capture.durationMs;
    const narration = narrationFor(event, transcript);
    const evidenceRefs = [...(event.evidenceRefs ?? [])].sort();
    const reviewState = reviewStateFor(event, evidenceById);
    const id = `step:${event.id}`;

    const contentHash = stableHash({
      id,
      kind: event.kind,
      atMs: event.atMs,
      endMs,
      label: event.label.trim(),
      narration,
      target: event.target?.trim(),
      evidenceRefs,
      reviewState,
    });

    return {
      id,
      sourceEventId: event.id,
      ordinal: index + 1,
      kind: event.kind,
      atMs: event.atMs,
      endMs,
      title: event.label.trim(),
      narration,
      target: event.target?.trim(),
      evidenceRefs,
      reviewState,
      contentHash,
    };
  });
}

function aggregateReviewState(states: ReviewState[]): ReviewState {
  return states.includes("BLOCKED_REVIEW") ? "BLOCKED_REVIEW" : "READY";
}

function compileGuide(graph: StepGraph): GuideDocument {
  const sections = graph.steps.map((step) => {
    const body = step.target
      ? `${step.narration} Target: ${step.target}.`
      : step.narration;
    const artifactHash = stableHash({
      sourceRevisionId: graph.revision.id,
      sourceStepId: step.id,
      stepContentHash: step.contentHash,
      title: step.title,
      body,
      evidenceRefs: step.evidenceRefs,
      reviewState: step.reviewState,
    });

    return {
      id: `guide:${step.id}`,
      sourceStepId: step.id,
      title: step.title,
      body,
      evidenceRefs: step.evidenceRefs,
      reviewState: step.reviewState,
      artifactHash,
    };
  });

  return {
    workspaceId: graph.revision.workspaceId,
    workflowId: graph.revision.workflowId,
    sourceRevisionId: graph.revision.id,
    sections,
    artifactHash: stableHash(sections.map((section) => section.artifactHash)),
    reviewState: aggregateReviewState(sections.map((section) => section.reviewState)),
  };
}

function compileVideoPlan(graph: StepGraph): VideoPlan {
  const scenes = graph.steps.map((step) => {
    const artifactHash = stableHash({
      sourceRevisionId: graph.revision.id,
      sourceStepId: step.id,
      stepContentHash: step.contentHash,
      startMs: step.atMs,
      endMs: step.endMs,
      narration: step.narration,
      evidenceRefs: step.evidenceRefs,
      reviewState: step.reviewState,
    });

    return {
      id: `scene:${step.id}`,
      sourceStepId: step.id,
      startMs: step.atMs,
      endMs: step.endMs,
      narration: step.narration,
      evidenceRefs: step.evidenceRefs,
      reviewState: step.reviewState,
      artifactHash,
    };
  });

  return {
    workspaceId: graph.revision.workspaceId,
    workflowId: graph.revision.workflowId,
    sourceRevisionId: graph.revision.id,
    scenes,
    artifactHash: stableHash(scenes.map((scene) => scene.artifactHash)),
    reviewState: aggregateReviewState(scenes.map((scene) => scene.reviewState)),
  };
}

export function compileWorkflow(captureInput: WorkflowCapture): CompiledWorkflowArtifacts {
  const capture = normalizedCapture(captureInput);
  const captureHash = stableHash(capture);
  const revisionId = `revision:${captureHash.slice(0, 24)}`;
  const steps = compileSteps(capture);

  const graph: StepGraph = {
    revision: {
      id: revisionId,
      workspaceId: capture.workspaceId,
      workflowId: capture.workflowId,
      captureId: capture.captureId,
      durationMs: capture.durationMs,
      captureHash,
    },
    steps,
  };

  return {
    graph,
    guide: compileGuide(graph),
    videoPlan: compileVideoPlan(graph),
  };
}

export function assertWorkspaceAccess(workspaceId: string, artifactWorkspaceId: string): void {
  if (workspaceId !== artifactWorkspaceId) {
    throw new Error("workspace boundary violation");
  }
}

export function assertPublishable(reviewState: ReviewState): void {
  if (reviewState !== "READY") {
    throw new Error("artifact is blocked pending review");
  }
}
