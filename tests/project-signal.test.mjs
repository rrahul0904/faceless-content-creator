import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertNoSecrets,
  checkCandidatePolicy,
  createActionCandidate,
  createIdeaCandidate,
  createProjectContextSnapshot,
  createSignalAssessment,
  evaluateCandidatePromotion,
  verifyEvidenceSpan,
} from '../lib/project-signal/index.ts';

const baseContext = (overrides = {}) => createProjectContextSnapshot({
  workspaceId: 'workspace-1',
  projectId: 'agent-work-os',
  projectRevision: 'rev-7',
  goals: ['Ship evidence-backed agent workflows', 'Reduce unsupported recommendations'],
  activeWorkstreams: ['youtube-intelligence', 'agent-evaluation'],
  standingDecisions: [
    {
      id: 'decision-no-paid-ads',
      statement: 'Do not recommend paid ads for this project.',
      effect: 'forbid',
      tags: ['paid-ads'],
    },
    {
      id: 'decision-external-review',
      statement: 'External publishing requires review.',
      effect: 'review',
      tags: ['external-publish'],
    },
  ],
  constraints: ['No autonomous publication'],
  vocabulary: ['REA', 'Project Signal Intelligence'],
  source: { kind: 'agent-work-os', sourceId: 'project:agent-work-os', revision: '7' },
  observedAt: '2026-10-17T04:00:00Z',
  ...overrides,
});

const cues = [
  { id: 'c1', startMs: 0, endMs: 3000, text: 'The useful part is to capture source evidence before making a recommendation.' },
  { id: 'c2', startMs: 3000, endMs: 6000, text: 'Then connect that evidence to the project you are actually building.' },
  { id: 'c3', startMs: 6000, endMs: 9000, text: 'A recommendation should become a proposal, not automatic execution authority.' },
];

test('ProjectContextSnapshot is canonical across set-like input ordering', () => {
  const left = baseContext();
  const right = baseContext({
    goals: ['Reduce unsupported recommendations', 'Ship evidence-backed agent workflows'],
    activeWorkstreams: ['agent-evaluation', 'youtube-intelligence'],
    standingDecisions: [
      {
        id: 'decision-external-review',
        statement: 'External publishing requires review.',
        effect: 'review',
        tags: ['external-publish'],
      },
      {
        id: 'decision-no-paid-ads',
        statement: 'Do not recommend paid ads for this project.',
        effect: 'forbid',
        tags: ['paid-ads'],
      },
    ],
  });
  assert.equal(left.digest, right.digest);
  assert.equal(left.policyDigest, right.policyDigest);
});

test('project revision changes assessment identity', () => {
  const first = baseContext();
  const second = baseContext({ projectRevision: 'rev-8' });
  assert.notEqual(first.digest, second.digest);

  const a = createSignalAssessment({
    sourceEvidenceId: 'video:abc12345678',
    projectContextDigest: first.digest,
    policyVersion: 'policy-v1',
    verdict: 'YES',
  });
  const b = createSignalAssessment({
    sourceEvidenceId: 'video:abc12345678',
    projectContextDigest: second.digest,
    policyVersion: 'policy-v1',
    verdict: 'YES',
  });
  assert.notEqual(a.digest, b.digest);
  assert.notEqual(a.assessmentId, b.assessmentId);
});

test('one exact contiguous passage is supported', () => {
  const span = verifyEvidenceSpan({
    sourceEvidenceId: 'transcript:1',
    normalizationVersion: 'caption-v1',
    quote: 'capture source evidence before making a recommendation',
    cues,
  });
  assert.equal(span.support, 'supported');
  assert.equal(span.reason, 'exact_contiguous_match');
  assert.equal(span.startCueId, 'c1');
  assert.equal(span.endCueId, 'c1');
});

test('a quote stitched from separated passages is rejected', () => {
  const span = verifyEvidenceSpan({
    sourceEvidenceId: 'transcript:1',
    normalizationVersion: 'caption-v1',
    quote: 'capture source evidence automatic execution authority',
    cues,
  });
  assert.equal(span.support, 'unsupported');
  assert.equal(span.reason, 'not_contiguous');
});

test('short generic phrases are not promoted as strong evidence', () => {
  const span = verifyEvidenceSpan({
    sourceEvidenceId: 'transcript:1',
    normalizationVersion: 'caption-v1',
    quote: 'source evidence before',
    cues,
  });
  assert.equal(span.support, 'ambiguous');
  assert.equal(span.reason, 'low_information');
});

test('forbidden standing decision deterministically rejects a positive candidate', () => {
  const context = baseContext();
  const candidate = createActionCandidate({
    projectId: context.projectId,
    text: 'Run paid ads to acquire users.',
    policyTags: ['paid-ads'],
    evidenceSpanDigests: ['a'.repeat(64)],
  });
  const receipt = checkCandidatePolicy(context, candidate, 'YES');
  assert.equal(receipt.result, 'reject');
  assert.equal(receipt.reason, 'forbidden');
  assert.equal(receipt.beforeVerdict, 'YES');
  assert.equal(receipt.afterVerdict, 'NO');
  assert.deepEqual(receipt.matchedDecisionIds, ['decision-no-paid-ads']);
});

test('review-required standing decision demotes a positive candidate', () => {
  const context = baseContext();
  const candidate = createActionCandidate({
    projectId: context.projectId,
    text: 'Publish the result externally.',
    policyTags: ['external-publish'],
    evidenceSpanDigests: ['b'.repeat(64)],
  });
  const receipt = checkCandidatePolicy(context, candidate, 'YES');
  assert.equal(receipt.result, 'demote');
  assert.equal(receipt.afterVerdict, 'MAYBE');
});

test('candidate dedupe identity stays stable across replay provenance', () => {
  const first = createIdeaCandidate({
    projectId: 'agent-work-os',
    workstreamId: 'youtube-intelligence',
    text: 'Add an evidence-linked project digest.',
    policyTags: ['research'],
    evidenceSpanDigests: ['c'.repeat(64)],
    originAssessmentDigests: ['d'.repeat(64)],
  });
  const replay = createIdeaCandidate({
    projectId: 'agent-work-os',
    workstreamId: 'youtube-intelligence',
    text: 'Add an evidence-linked project digest.',
    policyTags: ['research'],
    evidenceSpanDigests: ['e'.repeat(64)],
    originAssessmentDigests: ['f'.repeat(64)],
  });
  assert.equal(first.dedupeKey, replay.dedupeKey);
  assert.equal(first.candidateId, replay.candidateId);
  assert.notEqual(first.digest, replay.digest);
});

test('unsupported evidence prevents promotion and does not mutate the candidate', () => {
  const context = baseContext();
  const unsupported = verifyEvidenceSpan({
    sourceEvidenceId: 'transcript:1',
    normalizationVersion: 'caption-v1',
    quote: 'this phrase never appears as one passage',
    cues,
  });
  const candidate = createActionCandidate({
    projectId: context.projectId,
    text: 'Change the implementation based on this claim.',
    evidenceSpanDigests: [unsupported.digest],
  });
  const before = structuredClone(candidate);
  Object.freeze(candidate);
  const receipt = checkCandidatePolicy(context, candidate, 'YES');
  const evaluation = evaluateCandidatePromotion(candidate, [unsupported], receipt);
  assert.equal(evaluation.eligible, false);
  assert.equal(evaluation.reason, 'unsupported_evidence');
  assert.equal(evaluation.authority, 'proposal_only');
  assert.deepEqual(candidate, before);
});

test('supported evidence plus clear policy is eligible only as a proposal', () => {
  const context = baseContext();
  const supported = verifyEvidenceSpan({
    sourceEvidenceId: 'transcript:1',
    normalizationVersion: 'caption-v1',
    quote: 'connect that evidence to the project you are actually building',
    cues,
  });
  assert.equal(supported.support, 'supported');
  const candidate = createActionCandidate({
    projectId: context.projectId,
    text: 'Add project-context binding to the evidence model.',
    evidenceSpanDigests: [supported.digest],
  });
  const receipt = checkCandidatePolicy(context, candidate, 'YES');
  const evaluation = evaluateCandidatePromotion(candidate, [supported], receipt);
  assert.equal(evaluation.eligible, true);
  assert.equal(evaluation.reason, 'eligible');
  assert.equal(candidate.authority, 'proposal_only');
  assert.equal(evaluation.authority, 'proposal_only');
});

test('secret-looking values and sensitive fields are rejected from receipts', () => {
  assert.throws(() => assertNoSecrets({ apiKey: 'not-even-a-real-key' }), /sensitive field/);
  assert.throws(() => assertNoSecrets({ note: `sk-${'x'.repeat(24)}` }), /secret-looking value/);
});
