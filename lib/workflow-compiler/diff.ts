import type { StepGraph, WorkflowRevisionDiff } from "./schema";

function artifactKeys(stepId: string): string[] {
  return [`guide:${stepId}`, `scene:${stepId}`];
}

export function diffWorkflowRevisions(
  previous: StepGraph,
  current: StepGraph,
): WorkflowRevisionDiff {
  if (previous.revision.workspaceId !== current.revision.workspaceId) {
    throw new Error("cannot diff workflow revisions across workspaces");
  }
  if (previous.revision.workflowId !== current.revision.workflowId) {
    throw new Error("cannot diff different workflows");
  }

  const previousByEvent = new Map(previous.steps.map((step) => [step.sourceEventId, step]));
  const currentByEvent = new Map(current.steps.map((step) => [step.sourceEventId, step]));

  const unchangedStepIds: string[] = [];
  const addedStepIds: string[] = [];
  const modifiedStepIds: string[] = [];
  const removedStepIds: string[] = [];
  const invalidatedArtifactKeys = new Set<string>();

  for (const step of current.steps) {
    const previousStep = previousByEvent.get(step.sourceEventId);
    if (!previousStep) {
      addedStepIds.push(step.id);
      artifactKeys(step.id).forEach((key) => invalidatedArtifactKeys.add(key));
      continue;
    }

    if (previousStep.contentHash === step.contentHash) {
      unchangedStepIds.push(step.id);
      continue;
    }

    modifiedStepIds.push(step.id);
    artifactKeys(step.id).forEach((key) => invalidatedArtifactKeys.add(key));
  }

  for (const step of previous.steps) {
    if (!currentByEvent.has(step.sourceEventId)) {
      removedStepIds.push(step.id);
      artifactKeys(step.id).forEach((key) => invalidatedArtifactKeys.add(key));
    }
  }

  return {
    previousRevisionId: previous.revision.id,
    currentRevisionId: current.revision.id,
    unchangedStepIds: unchangedStepIds.sort(),
    addedStepIds: addedStepIds.sort(),
    modifiedStepIds: modifiedStepIds.sort(),
    removedStepIds: removedStepIds.sort(),
    invalidatedArtifactKeys: [...invalidatedArtifactKeys].sort(),
  };
}
