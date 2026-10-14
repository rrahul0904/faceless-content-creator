'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  partitionSamples,
  eligibleRules,
  normalizeFeedback,
  supportRule,
  setRuleState,
  analyzeTics,
  holdoutEvaluation
} = require('../lib/voice-learning');
const { buildContextPacket } = require('../lib/context');

test('holdout samples stay out of the learning partition', () => {
  const samples = [
    { id: 'learn-1', domain: 'linkedin', text: 'Short useful explanation.', holdout: false },
    { id: 'hold-1', domain: 'linkedin', text: 'Untouched validation sample.', holdout: true },
    { id: 'medium-1', domain: 'medium', text: 'Different domain sample.', holdout: false }
  ];
  const part = partitionSamples(samples, 'linkedin');
  assert.deepEqual(part.learning.map(x => x.id), ['learn-1']);
  assert.deepEqual(part.holdout.map(x => x.id), ['hold-1']);
});

test('only active or pinned rules eligible for the requested domain enter context', () => {
  const rules = [
    { id: 'global-active', domain: 'global', text: 'Prefer concrete language.', state: 'active', supportCount: 2 },
    { id: 'li-active', domain: 'linkedin', text: 'Use short opening paragraphs.', state: 'active', supportCount: 2 },
    { id: 'li-proposed', domain: 'linkedin', text: 'Never use commas.', state: 'proposed', supportCount: 1 },
    { id: 'li-rejected', domain: 'linkedin', text: 'Always start with a question.', state: 'rejected', supportCount: 9 },
    { id: 'medium-pinned', domain: 'medium', text: 'Use section headings.', state: 'pinned', supportCount: 0 }
  ];
  assert.deepEqual(eligibleRules(rules, 'linkedin').map(x => x.id), ['global-active', 'li-active']);
  assert.deepEqual(eligibleRules(rules, 'medium').map(x => x.id), ['global-active', 'medium-pinned']);

  const packet = buildContextPacket({
    topic: 'Snowflake query optimization',
    platform: 'linkedin',
    context: { voiceProfile: { version: 3, rules } }
  });
  assert.deepEqual(packet.voice.learnedRules.map(x => x.id), ['global-active', 'li-active']);
  assert.equal(packet.voiceLearning.profileVersion, 3);
  assert.equal(packet.guardrails.voiceRulesMayShapeExpressionNotFacts, true);
});

test('feedback receipt distinguishes approved and edited text deterministically', () => {
  const approved = normalizeFeedback({ requestId: 'r1', domain: 'linkedin', verdict: 'approved', draft: 'Ship the useful version.' });
  assert.equal(approved.diff.changed, false);
  assert.equal(approved.diff.draftHash, approved.diff.finalHash);

  const edited = normalizeFeedback({ requestId: 'r2', domain: 'linkedin', verdict: 'edited', draft: 'This is revolutionary!', finalText: 'This is useful in practice.', reason: 'Avoid hype.' });
  assert.equal(edited.diff.changed, true);
  assert.notEqual(edited.diff.draftHash, edited.diff.finalHash);
  assert.equal(edited.reason, 'Avoid hype.');
});

test('rule support activates at threshold while rejected rules stay rejected', () => {
  const proposed = { id: 'r', domain: 'linkedin', text: 'Avoid hype.', state: 'proposed', supportCount: 0 };
  const once = supportRule(proposed, 'feedback-1');
  assert.equal(once.state, 'proposed');
  assert.equal(once.supportCount, 1);
  const twice = supportRule(once, 'feedback-2');
  assert.equal(twice.state, 'active');
  assert.equal(twice.supportCount, 2);

  const rejected = setRuleState(twice, 'rejected');
  const after = supportRule(rejected, 'feedback-3', { explicitReason: true });
  assert.equal(after.state, 'rejected');
  assert.equal(after.supportCount, rejected.supportCount);
});

test('explicit user reason can satisfy the deterministic support threshold once', () => {
  const result = supportRule({ id: 'r-explicit', domain: 'global', text: 'Prefer direct openings.', state: 'proposed', supportCount: 0 }, 'feedback-explicit', { explicitReason: true });
  assert.equal(result.state, 'active');
  assert.equal(result.supportCount, 2);
  const duplicate = supportRule(result, 'feedback-explicit', { explicitReason: true });
  assert.equal(duplicate.supportCount, 2);
});

test('tic analysis exposes counted evidence before any suggestion layer', () => {
  const report = analyzeTics([
    'The key point is evidence. The real point is proof.',
    'The key point is repeatability.',
    'The key point is not hype.'
  ]);
  assert.equal(report.ordering, 'counts-before-suggestions');
  assert.deepEqual(report.suggestions, []);
  assert.ok(report.evidence.some(item => item.phrase === 'the key point' && item.count === 3));
});

test('holdout evaluation is explicit about Phase A limits', () => {
  const result = holdoutEvaluation({
    version: 4,
    samples: [
      { id: 'a', domain: 'linkedin', text: 'Keep it concrete. Keep it useful.', holdout: false },
      { id: 'b', domain: 'linkedin', text: 'Keep it concrete. Keep it grounded.', holdout: true }
    ]
  }, 'linkedin');
  assert.equal(result.profileVersion, 4);
  assert.equal(result.learningSampleCount, 1);
  assert.equal(result.holdoutSampleCount, 1);
  assert.equal(result.status, 'measured-scaffold');
  assert.match(result.note, /does not claim semantic style-fidelity scoring/);
});
