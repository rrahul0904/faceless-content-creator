export type WorkflowEventKind =
  | "click"
  | "input"
  | "navigation"
  | "submit"
  | "wait"
  | "custom";

export type ReviewState = "READY" | "BLOCKED_REVIEW";

export interface VisualEvidenceRef {
  id: string;
  uri: string;
  capturedAtMs: number;
  sensitive?: boolean;
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface WorkflowEvent {
  id: string;
  kind: WorkflowEventKind;
  atMs: number;
  label: string;
  target?: string;
  evidenceRefs?: string[];
  sensitive?: boolean;
}

export interface WorkflowCapture {
  workspaceId: string;
  workflowId: string;
  captureId: string;
  durationMs: number;
  events: WorkflowEvent[];
  transcript?: TranscriptSegment[];
  evidence?: VisualEvidenceRef[];
}

export interface WorkflowStep {
  id: string;
  sourceEventId: string;
  ordinal: number;
  kind: WorkflowEventKind;
  atMs: number;
  endMs: number;
  title: string;
  narration: string;
  target?: string;
  evidenceRefs: string[];
  reviewState: ReviewState;
  contentHash: string;
}

export interface WorkflowRevision {
  id: string;
  workspaceId: string;
  workflowId: string;
  captureId: string;
  durationMs: number;
  captureHash: string;
}

export interface StepGraph {
  revision: WorkflowRevision;
  steps: WorkflowStep[];
}

export interface GuideSection {
  id: string;
  sourceStepId: string;
  title: string;
  body: string;
  evidenceRefs: string[];
  reviewState: ReviewState;
  artifactHash: string;
}

export interface GuideDocument {
  workspaceId: string;
  workflowId: string;
  sourceRevisionId: string;
  sections: GuideSection[];
  artifactHash: string;
  reviewState: ReviewState;
}

export interface VideoScene {
  id: string;
  sourceStepId: string;
  startMs: number;
  endMs: number;
  narration: string;
  evidenceRefs: string[];
  reviewState: ReviewState;
  artifactHash: string;
}

export interface VideoPlan {
  workspaceId: string;
  workflowId: string;
  sourceRevisionId: string;
  scenes: VideoScene[];
  artifactHash: string;
  reviewState: ReviewState;
}

export interface CompiledWorkflowArtifacts {
  graph: StepGraph;
  guide: GuideDocument;
  videoPlan: VideoPlan;
}

export interface WorkflowRevisionDiff {
  previousRevisionId: string;
  currentRevisionId: string;
  unchangedStepIds: string[];
  addedStepIds: string[];
  modifiedStepIds: string[];
  removedStepIds: string[];
  invalidatedArtifactKeys: string[];
}

export interface CostRateCard {
  aiVideoPerMinute?: number;
  aiDocumentFlat?: number;
  translationPerMinute?: number;
  avatarPerMinute?: number;
}

export interface CostEstimateRequest {
  durationMs: number;
  includeVideo: boolean;
  includeGuide: boolean;
  languages?: string[];
  includeAvatar?: boolean;
  rates?: CostRateCard;
}

export interface CostLineItem {
  operation: "ai-video" | "ai-document" | "translation" | "avatar";
  units: number;
  unitLabel: "minute" | "document";
  rate: number | null;
  estimatedCost: number | null;
}

export interface CostEstimate {
  durationMinutes: number;
  languages: string[];
  lineItems: CostLineItem[];
  estimatedTotal: number | null;
  hasUnknownRates: boolean;
}
