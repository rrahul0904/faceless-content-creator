'use strict';

const crypto = require('crypto');

const RULE_STATES = new Set(['proposed', 'active', 'pinned', 'rejected']);
const VERDICTS = new Set(['approved', 'edited', 'rejected']);

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function cleanDomain(value) {
  const domain = String(value || 'global').trim().toLowerCase();
  return domain.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'global';
}

function normalizeSamples(samples = []) {
  return (Array.isArray(samples) ? samples : []).slice(0, 500).map((sample, index) => ({
    id: String(sample.id || `sample-${index + 1}`).slice(0, 120),
    domain: cleanDomain(sample.domain),
    text: String(sample.text || '').slice(0, 12000),
    source: String(sample.source || 'user').slice(0, 80),
    holdout: Boolean(sample.holdout),
    createdAt: sample.createdAt ? String(sample.createdAt) : null
  })).filter(sample => sample.text);
}

function normalizeRules(rules = []) {
  return (Array.isArray(rules) ? rules : []).slice(0, 300).map((rule, index) => {
    const state = RULE_STATES.has(rule.state) ? rule.state : 'proposed';
    return {
      id: String(rule.id || `rule-${index + 1}`).slice(0, 120),
      domain: cleanDomain(rule.domain),
      text: String(rule.text || '').trim().slice(0, 1200),
      state,
      supportCount: Math.max(0, Math.min(1000, Number(rule.supportCount || 0))),
      evidenceIds: [...new Set((Array.isArray(rule.evidenceIds) ? rule.evidenceIds : []).map(String))].slice(0, 100),
      createdAt: rule.createdAt ? String(rule.createdAt) : null,
      updatedAt: rule.updatedAt ? String(rule.updatedAt) : null
    };
  }).filter(rule => rule.text);
}

function normalizeProfile(profile = {}) {
  return {
    schema: 'creator-voice-profile/v1',
    id: String(profile.id || 'default').slice(0, 120),
    version: Math.max(1, Number(profile.version || 1)),
    styleCard: {
      tone: String(profile.styleCard?.tone || profile.tone || '').slice(0, 1600),
      dos: (Array.isArray(profile.styleCard?.dos) ? profile.styleCard.dos : (Array.isArray(profile.dos) ? profile.dos : [])).slice(0, 40).map(String),
      donts: (Array.isArray(profile.styleCard?.donts) ? profile.styleCard.donts : (Array.isArray(profile.donts) ? profile.donts : [])).slice(0, 40).map(String),
      examples: (Array.isArray(profile.styleCard?.examples) ? profile.styleCard.examples : (Array.isArray(profile.examples) ? profile.examples : [])).slice(0, 12).map(String)
    },
    samples: normalizeSamples(profile.samples),
    rules: normalizeRules(profile.rules)
  };
}

function partitionSamples(samples = [], domain = 'global') {
  const target = cleanDomain(domain);
  const relevant = normalizeSamples(samples).filter(sample => sample.domain === 'global' || sample.domain === target);
  return {
    learning: relevant.filter(sample => !sample.holdout),
    holdout: relevant.filter(sample => sample.holdout)
  };
}

function eligibleRules(rules = [], domain = 'global') {
  const target = cleanDomain(domain);
  return normalizeRules(rules).filter(rule =>
    (rule.domain === 'global' || rule.domain === target) &&
    (rule.state === 'active' || rule.state === 'pinned')
  );
}

function wordTokens(text) {
  return String(text || '').match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
}

function punctuationCounts(text) {
  const source = String(text || '');
  const count = char => source.split(char).length - 1;
  return {
    exclamation: count('!'),
    question: count('?'),
    semicolon: count(';'),
    colon: count(':'),
    emDash: count('—')
  };
}

function feedbackDiff(draft, finalText) {
  const before = wordTokens(draft);
  const after = wordTokens(finalText);
  const beforeFreq = new Map();
  const afterFreq = new Map();
  for (const token of before.map(x => x.toLowerCase())) beforeFreq.set(token, (beforeFreq.get(token) || 0) + 1);
  for (const token of after.map(x => x.toLowerCase())) afterFreq.set(token, (afterFreq.get(token) || 0) + 1);
  let removed = 0;
  let added = 0;
  for (const [token, count] of beforeFreq) removed += Math.max(0, count - (afterFreq.get(token) || 0));
  for (const [token, count] of afterFreq) added += Math.max(0, count - (beforeFreq.get(token) || 0));
  return {
    draftHash: hashText(draft),
    finalHash: hashText(finalText),
    changed: hashText(draft) !== hashText(finalText),
    wordsBefore: before.length,
    wordsAfter: after.length,
    addedTokenCount: added,
    removedTokenCount: removed,
    punctuationBefore: punctuationCounts(draft),
    punctuationAfter: punctuationCounts(finalText)
  };
}

function normalizeFeedback(input = {}) {
  const verdict = VERDICTS.has(input.verdict) ? input.verdict : null;
  if (!String(input.requestId || '').trim()) throw Object.assign(new Error('requestId is required'), { code: 'VOICE_REQUEST_ID_REQUIRED' });
  if (!verdict) throw Object.assign(new Error('verdict must be approved, edited or rejected'), { code: 'VOICE_VERDICT_INVALID' });
  const draft = String(input.draft || '');
  const finalText = verdict === 'approved' ? draft : String(input.finalText || '');
  if (verdict === 'edited' && !finalText) throw Object.assign(new Error('edited feedback requires finalText'), { code: 'VOICE_FINAL_TEXT_REQUIRED' });
  return {
    schema: 'creator-voice-feedback/v1',
    requestId: String(input.requestId).slice(0, 160),
    domain: cleanDomain(input.domain),
    verdict,
    reason: input.reason ? String(input.reason).slice(0, 2000) : null,
    wasSent: input.wasSent === undefined ? verdict !== 'rejected' : Boolean(input.wasSent),
    diff: feedbackDiff(draft, finalText),
    finalText: verdict === 'rejected' ? null : finalText.slice(0, 12000)
  };
}

function supportRule(rule, evidenceId, { explicitReason = false, activationThreshold = 2 } = {}) {
  const current = normalizeRules([rule])[0];
  if (!current) throw Object.assign(new Error('valid rule is required'), { code: 'VOICE_RULE_REQUIRED' });
  if (current.state === 'rejected' || current.state === 'pinned') return current;
  const id = String(evidenceId || '').trim();
  const evidenceIds = id ? [...new Set([...current.evidenceIds, id])] : current.evidenceIds;
  const newlySupported = id && !current.evidenceIds.includes(id);
  const increment = newlySupported ? (explicitReason ? 2 : 1) : 0;
  const supportCount = current.supportCount + increment;
  return {
    ...current,
    supportCount,
    evidenceIds,
    state: supportCount >= Math.max(1, Number(activationThreshold || 2)) ? 'active' : current.state
  };
}

function setRuleState(rule, state) {
  if (!RULE_STATES.has(state)) throw Object.assign(new Error('invalid rule state'), { code: 'VOICE_RULE_STATE_INVALID' });
  const current = normalizeRules([rule])[0];
  if (!current) throw Object.assign(new Error('valid rule is required'), { code: 'VOICE_RULE_REQUIRED' });
  return { ...current, state };
}

function normalizePhrase(text) {
  return wordTokens(text).map(token => token.toLowerCase()).join(' ');
}

function analyzeTics(texts = [], { minCount = 2, maxItems = 20 } = {}) {
  const counts = new Map();
  for (const raw of (Array.isArray(texts) ? texts : [])) {
    const tokens = normalizePhrase(raw).split(' ').filter(Boolean);
    const seenInText = new Set();
    for (const n of [2, 3]) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const phrase = tokens.slice(i, i + n).join(' ');
        if (phrase.length < 6) continue;
        seenInText.add(`${n}:${phrase}`);
      }
    }
    for (const key of seenInText) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const evidence = [...counts.entries()]
    .map(([key, count]) => ({ phrase: key.slice(key.indexOf(':') + 1), ngram: Number(key.split(':')[0]), count }))
    .filter(item => item.count >= Math.max(2, Number(minCount || 2)))
    .sort((a, b) => b.count - a.count || b.ngram - a.ngram || a.phrase.localeCompare(b.phrase))
    .slice(0, Math.max(1, Math.min(100, Number(maxItems || 20))));
  return {
    schema: 'creator-voice-tics/v1',
    evidence,
    suggestions: [],
    ordering: 'counts-before-suggestions'
  };
}

function holdoutEvaluation(profile = {}, domain = 'global') {
  const clean = normalizeProfile(profile);
  const partition = partitionSamples(clean.samples, domain);
  const learningTics = analyzeTics(partition.learning.map(sample => sample.text));
  const holdoutTics = analyzeTics(partition.holdout.map(sample => sample.text));
  const learningPhrases = new Set(learningTics.evidence.map(item => item.phrase));
  const holdoutPhrases = new Set(holdoutTics.evidence.map(item => item.phrase));
  const shared = [...learningPhrases].filter(phrase => holdoutPhrases.has(phrase));
  return {
    schema: 'creator-voice-eval/v1',
    profileVersion: clean.version,
    domain: cleanDomain(domain),
    learningSampleCount: partition.learning.length,
    holdoutSampleCount: partition.holdout.length,
    repeatedPhraseOverlapCount: shared.length,
    status: partition.holdout.length ? 'measured-scaffold' : 'insufficient-holdout',
    note: 'Phase A reports deterministic holdout/tic evidence only; it does not claim semantic style-fidelity scoring.'
  };
}

module.exports = {
  RULE_STATES,
  VERDICTS,
  hashText,
  cleanDomain,
  normalizeSamples,
  normalizeRules,
  normalizeProfile,
  partitionSamples,
  eligibleRules,
  feedbackDiff,
  normalizeFeedback,
  supportRule,
  setRuleState,
  analyzeTics,
  holdoutEvaluation
};
