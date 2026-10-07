import assert from "node:assert/strict";

import {
  assertPublishable,
  assertWorkspaceAccess,
  compileWorkflow,
  diffWorkflowRevisions,
  estimateWorkflowCost,
} from "../lib/workflow-compiler";
import type { WorkflowCapture } from "../lib/workflow-compiler";

const baseCapture: WorkflowCapture = {
  workspaceId: "workspace-a",
  workflowId: "invite-user",
  captureId: "capture-001",
  durationMs: 12_000,
  evidence: [
    {
      id: "shot-1",
      uri: "evidence://capture-001/shot-1.png",
      capturedAtMs: 1_000,
    },
    {
      id: "shot-2",
      uri: "evidence://capture-001/shot-2.png",
      capturedAtMs: 6_000,
    },
  ],
  transcript: [
    {
      id: "t-1",
      startMs: 0,
      endMs: 4_000,
      text: "Open the team settings page.",
    },
    {
      id: "t-2",
      startMs: 4_001,
      endMs: 9_000,
      text: "Choose invite member and enter the email address.",
    },
  ],
  events: [
    {
      id: "event-open-settings",
      kind: "navigation",
      atMs: 1_000,
      label: "Open team settings",
      target: "/settings/team",
      evidenceRefs: ["shot-1"],
    },
    {
      id: "event-invite-member",
      kind: "click",
      atMs: 6_000,
      label: "Invite a team member",
      target: "button[invite-member]",
      evidenceRefs: ["shot-2"],
    },
  ],
};

const compiled = compileWorkflow(baseCapture);
assert.equal(compiled.graph.steps.length, 2);
assert.equal(compiled.graph.steps[0].sourceEventId, "event-open-settings");
assert.deepEqual(compiled.guide.sections[0].evidenceRefs, ["shot-1"]);
assert.equal(compiled.videoPlan.scenes[1].sourceStepId, "step:event-invite-member");
assert.equal(compiled.guide.sourceRevisionId, compiled.graph.revision.id);
assert.equal(compiled.videoPlan.sourceRevisionId, compiled.graph.revision.id);

// Input collection order must not change the compiled revision.
const reordered = compileWorkflow({
  ...baseCapture,
  evidence: [...(baseCapture.evidence ?? [])].reverse(),
  transcript: [...(baseCapture.transcript ?? [])].reverse(),
  events: [...baseCapture.events].reverse(),
});
assert.equal(reordered.graph.revision.id, compiled.graph.revision.id);
assert.deepEqual(
  reordered.graph.steps.map((step) => step.contentHash),
  compiled.graph.steps.map((step) => step.contentHash),
);

// A content edit must produce a new immutable revision and invalidate only the changed step.
const changedCapture: WorkflowCapture = {
  ...baseCapture,
  captureId: "capture-002",
  events: baseCapture.events.map((event) =>
    event.id === "event-invite-member"
      ? { ...event, label: "Invite a teammate" }
      : { ...event },
  ),
};
const changed = compileWorkflow(changedCapture);
assert.notEqual(changed.graph.revision.id, compiled.graph.revision.id);
const revisionDiff = diffWorkflowRevisions(compiled.graph, changed.graph);
assert.deepEqual(revisionDiff.unchangedStepIds, ["step:event-open-settings"]);
assert.deepEqual(revisionDiff.modifiedStepIds, ["step:event-invite-member"]);
assert.deepEqual(revisionDiff.addedStepIds, []);
assert.deepEqual(revisionDiff.removedStepIds, []);
assert.deepEqual(revisionDiff.invalidatedArtifactKeys, [
  "guide:step:event-invite-member",
  "scene:step:event-invite-member",
]);

// Sensitive evidence must propagate to derived artifacts and publishing must fail closed.
const sensitive = compileWorkflow({
  ...baseCapture,
  captureId: "capture-sensitive",
  evidence: (baseCapture.evidence ?? []).map((evidence) =>
    evidence.id === "shot-2" ? { ...evidence, sensitive: true } : { ...evidence },
  ),
});
assert.equal(sensitive.graph.steps[1].reviewState, "BLOCKED_REVIEW");
assert.equal(sensitive.guide.sections[1].reviewState, "BLOCKED_REVIEW");
assert.equal(sensitive.videoPlan.scenes[1].reviewState, "BLOCKED_REVIEW");
assert.equal(sensitive.guide.reviewState, "BLOCKED_REVIEW");
assert.throws(() => assertPublishable(sensitive.guide.reviewState), /blocked pending review/);
assert.doesNotThrow(() => assertPublishable(compiled.guide.reviewState));

// Tenant boundaries fail closed both for direct access and revision comparisons.
assert.doesNotThrow(() => assertWorkspaceAccess("workspace-a", compiled.guide.workspaceId));
assert.throws(
  () => assertWorkspaceAccess("workspace-b", compiled.guide.workspaceId),
  /workspace boundary violation/,
);
const otherWorkspace = compileWorkflow({ ...baseCapture, workspaceId: "workspace-b" });
assert.throws(
  () => diffWorkflowRevisions(compiled.graph, otherWorkspace.graph),
  /across workspaces/,
);

// Invalid evidence references and invalid timestamps are rejected before compilation.
assert.throws(
  () =>
    compileWorkflow({
      ...baseCapture,
      events: [{ ...baseCapture.events[0], evidenceRefs: ["missing-shot"] }],
    }),
  /missing evidence/,
);
assert.throws(
  () =>
    compileWorkflow({
      ...baseCapture,
      events: [{ ...baseCapture.events[0], atMs: -1 }],
    }),
  /must be between/,
);

// Cost preflight is deterministic, de-duplicates locales and refuses to invent missing prices.
const knownCost = estimateWorkflowCost({
  durationMs: 120_000,
  includeVideo: true,
  includeGuide: true,
  languages: ["es", "fr", "es"],
  includeAvatar: true,
  rates: {
    aiVideoPerMinute: 1,
    aiDocumentFlat: 0.5,
    translationPerMinute: 0.25,
    avatarPerMinute: 0.75,
  },
});
assert.deepEqual(knownCost.languages, ["es", "fr"]);
assert.equal(knownCost.durationMinutes, 2);
assert.equal(knownCost.hasUnknownRates, false);
assert.equal(knownCost.estimatedTotal, 5);

const unknownCost = estimateWorkflowCost({
  durationMs: 60_000,
  includeVideo: true,
  includeGuide: false,
});
assert.equal(unknownCost.hasUnknownRates, true);
assert.equal(unknownCost.estimatedTotal, null);

console.log(
  JSON.stringify(
    {
      status: "ok",
      revisionId: compiled.graph.revision.id,
      assertions: 29,
      invalidatedArtifactKeys: revisionDiff.invalidatedArtifactKeys,
      knownCost,
    },
    null,
    2,
  ),
);
