import { createHash } from 'node:crypto';

export type SignalVerdict = 'YES' | 'OPPORTUNITY' | 'MAYBE' | 'NO';
export type DecisionEffect = 'allow' | 'review' | 'forbid';
export type EvidenceSupport = 'supported' | 'unsupported' | 'ambiguous';
export type PolicyCheckResult = 'allow' | 'demote' | 'reject' | 'review';
export type PromotionState = 'draft' | 'review' | 'accepted' | 'proposed-work-item' | 'rejected';

export interface StandingDecisionInput {
  id: string;
  statement: string;
  effect: DecisionEffect;
  tags: string[];
}

export interface ProjectContextSnapshotInput {
  workspaceId: string;
  projectId: string;
  projectRevision: string;
  goals: string[];
  activeWorkstreams?: string[];
  standingDecisions?: StandingDecisionInput[];
  constraints?: string[];
  vocabulary?: string[];
  source: {
    kind: 'manual' | 'project' | 'agent-work-os' | 'import';
    sourceId: string;
    revision?: string;
  };
  observedAt?: string;
}

export interface ProjectContextSnapshot extends ProjectContextSnapshotInput {
  kind: 'project-context-snapshot/v1';
  activeWorkstreams: string[];
  standingDecisions: StandingDecisionInput[];
  constraints: string[];
  vocabulary: string[];
  policyDigest: string;
  digest: string;
}

export interface TranscriptCue {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface EvidenceSpan {
  kind: 'evidence-span/v1';
  sourceEvidenceId: string;
  normalizationVersion: string;
  quote: string;
  canonicalQuote: string;
  support: EvidenceSupport;
  reason:
    | 'exact_contiguous_match'
    | 'too_short'
    | 'low_information'
    | 'not_contiguous'
    | 'repeated_match';
  startCueId?: string;
  endCueId?: string;
  startTokenIndex?: number;
  endTokenIndex?: number;
  digest: string;
}

export interface SignalRecommendationInput {
  id: string;
  text: string;
  evidenceSpanDigests?: string[];
  policyTags?: string[];
}

export interface SignalAssessmentInput {
  sourceEvidenceId: string;
  projectContextDigest: string;
  policyVersion: string;
  verdict: SignalVerdict;
  recommendations?: SignalRecommendationInput[];
  unknowns?: string[];
  provider?: {
    kind: 'agent' | 'local' | 'api' | 'deterministic';
    provider: string;
    model?: string;
    revision?: string;
  };
}

export interface SignalAssessment extends Omit<SignalAssessmentInput, 'recommendations' | 'unknowns'> {
  kind: 'signal-assessment/v1';
  recommendations: Required<SignalRecommendationInput>[];
  unknowns: string[];
  assessmentId: string;
  digest: string;
}

export interface CandidateInput {
  projectId: string;
  workstreamId?: string;
  text: string;
  evidenceSpanDigests?: string[];
  originAssessmentDigests?: string[];
  policyTags?: string[];
}

export interface SignalCandidate extends CandidateInput {
  kind: 'action-candidate/v1' | 'idea-candidate/v1';
  candidateId: string;
  dedupeKey: string;
  evidenceSpanDigests: string[];
  originAssessmentDigests: string[];
  policyTags: string[];
  promotionState: PromotionState;
  authority: 'proposal_only';
  digest: string;
}

export interface PolicyCheckReceipt {
  kind: 'policy-check-receipt/v1';
  candidateId: string;
  policySetDigest: string;
  matchedDecisionIds: string[];
  result: PolicyCheckResult;
  reason: 'no_policy_match' | 'explicit_allow' | 'review_required' | 'forbidden';
  beforeVerdict: SignalVerdict;
  afterVerdict: SignalVerdict;
  digest: string;
}

export interface PromotionEvaluation {
  eligible: boolean;
  reason: 'eligible' | 'missing_evidence' | 'unsupported_evidence' | 'policy_not_clear' | 'receipt_mismatch';
  authority: 'proposal_only';
}

const DIGEST_RE = /^[a-f0-9]{64}$/;
const POLICY_TAG_RE = /^[a-z0-9][a-z0-9._:-]{0,99}$/;
const SENSITIVE_KEY_RE = /^(?:apikey|accesstoken|refreshtoken|authorization|password|secret|cookie|privatekey|clientsecret)$/i;
const SENSITIVE_VALUE_RE = /^(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{8,}\.)/;

function requireText(value: string, field: string, max = 4000): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  if (normalized.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return normalized;
}

function requireDigest(value: string, field: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!DIGEST_RE.test(normalized)) throw new Error(`${field} must be a sha256 hex digest`);
  return normalized;
}

function normalizeTag(value: string): string {
  const tag = requireText(value, 'policy tag', 100).toLowerCase();
  if (!POLICY_TAG_RE.test(tag)) throw new Error(`invalid policy tag '${tag}'`);
  return tag;
}

function uniqueSorted(values: string[], field: string, maxItem = 1000): string[] {
  return [...new Set(values.map((value) => requireText(value, field, maxItem)))].sort((a, b) => a.localeCompare(b));
}

function normalizeTags(values: string[] = []): string[] {
  return [...new Set(values.map(normalizeTag))].sort((a, b) => a.localeCompare(b));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical values cannot contain non-finite numbers');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, child]) => [key, canonicalValue(child)]));
  }
  throw new Error(`unsupported canonical value type: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function assertNoSecrets(value: unknown, path = 'root'): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoSecrets(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const compactKey = key.replace(/[-_]/g, '');
      if (SENSITIVE_KEY_RE.test(compactKey) && child !== undefined && child !== null && String(child).trim()) {
        throw new Error(`sensitive field '${path}.${key}' is not allowed in project-signal receipts`);
      }
      assertNoSecrets(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && SENSITIVE_VALUE_RE.test(value.trim())) {
    throw new Error(`secret-looking value at '${path}' is not allowed in project-signal receipts`);
  }
}

export function createProjectContextSnapshot(input: ProjectContextSnapshotInput): ProjectContextSnapshot {
  assertNoSecrets(input);
  const standingDecisions = (input.standingDecisions ?? []).map((decision) => ({
    id: requireText(decision.id, 'standing decision id', 200),
    statement: requireText(decision.statement, 'standing decision statement', 4000),
    effect: decision.effect,
    tags: normalizeTags(decision.tags),
  }));

  for (const decision of standingDecisions) {
    if (!['allow', 'review', 'forbid'].includes(decision.effect)) throw new Error(`invalid decision effect '${decision.effect}'`);
    if (!decision.tags.length) throw new Error(`standing decision '${decision.id}' must have at least one policy tag`);
  }
  const decisionIds = standingDecisions.map((decision) => decision.id);
  if (new Set(decisionIds).size !== decisionIds.length) throw new Error('standing decision ids must be unique');
  standingDecisions.sort((a, b) => a.id.localeCompare(b.id));

  const normalized = {
    workspaceId: requireText(input.workspaceId, 'workspaceId', 200),
    projectId: requireText(input.projectId, 'projectId', 200),
    projectRevision: requireText(input.projectRevision, 'projectRevision', 200),
    goals: uniqueSorted(input.goals, 'goal', 2000),
    activeWorkstreams: uniqueSorted(input.activeWorkstreams ?? [], 'active workstream', 1000),
    standingDecisions,
    constraints: uniqueSorted(input.constraints ?? [], 'constraint', 2000),
    vocabulary: uniqueSorted(input.vocabulary ?? [], 'vocabulary item', 500),
    source: {
      kind: input.source.kind,
      sourceId: requireText(input.source.sourceId, 'source.sourceId', 500),
      ...(input.source.revision ? { revision: requireText(input.source.revision, 'source.revision', 200) } : {}),
    },
    ...(input.observedAt ? { observedAt: requireText(input.observedAt, 'observedAt', 100) } : {}),
  };

  if (!['manual', 'project', 'agent-work-os', 'import'].includes(normalized.source.kind)) {
    throw new Error(`invalid project context source kind '${normalized.source.kind}'`);
  }
  if (!normalized.goals.length) throw new Error('ProjectContextSnapshot requires at least one goal');

  const policyDigest = canonicalDigest(normalized.standingDecisions);
  const semanticIdentity = {
    ...normalized,
    observedAt: undefined,
    policyDigest,
  };
  const digest = canonicalDigest(semanticIdentity);
  return { kind: 'project-context-snapshot/v1', ...normalized, policyDigest, digest };
}

function tokens(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function validateCues(cues: TranscriptCue[]): TranscriptCue[] {
  if (!cues.length) throw new Error('at least one transcript cue is required');
  const ids = new Set<string>();
  let priorStart = -1;
  return cues.map((cue, index) => {
    const id = requireText(cue.id, `cues[${index}].id`, 200);
    const text = requireText(cue.text, `cues[${index}].text`, 20000);
    if (ids.has(id)) throw new Error(`duplicate transcript cue id '${id}'`);
    ids.add(id);
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0 || cue.endMs < cue.startMs) {
      throw new Error(`invalid transcript cue timing for '${id}'`);
    }
    if (cue.startMs < priorStart) throw new Error('transcript cues must be ordered by startMs');
    priorStart = cue.startMs;
    return { id, text, startMs: cue.startMs, endMs: cue.endMs };
  });
}

export function verifyEvidenceSpan(input: {
  sourceEvidenceId: string;
  normalizationVersion: string;
  quote: string;
  cues: TranscriptCue[];
}): EvidenceSpan {
  assertNoSecrets(input);
  const sourceEvidenceId = requireText(input.sourceEvidenceId, 'sourceEvidenceId', 500);
  const normalizationVersion = requireText(input.normalizationVersion, 'normalizationVersion', 200);
  const quote = requireText(input.quote, 'quote', 10000);
  const quoteTokens = tokens(quote);
  const canonicalQuote = quoteTokens.join(' ');
  const cues = validateCues(input.cues);

  const make = (partial: Omit<EvidenceSpan, 'kind' | 'sourceEvidenceId' | 'normalizationVersion' | 'quote' | 'canonicalQuote' | 'digest'>): EvidenceSpan => {
    const base = { sourceEvidenceId, normalizationVersion, quote, canonicalQuote, ...partial };
    return { kind: 'evidence-span/v1', ...base, digest: canonicalDigest(base) };
  };

  if (quoteTokens.length < 3) return make({ support: 'unsupported', reason: 'too_short' });

  const transcriptTokens: Array<{ token: string; cueId: string }> = [];
  for (const cue of cues) {
    for (const token of tokens(cue.text)) transcriptTokens.push({ token, cueId: cue.id });
  }

  const matches: number[] = [];
  outer: for (let start = 0; start <= transcriptTokens.length - quoteTokens.length; start += 1) {
    for (let offset = 0; offset < quoteTokens.length; offset += 1) {
      if (transcriptTokens[start + offset].token !== quoteTokens[offset]) continue outer;
    }
    matches.push(start);
  }

  if (!matches.length) return make({ support: 'unsupported', reason: 'not_contiguous' });
  if (quoteTokens.length < 6) return make({ support: 'ambiguous', reason: 'low_information' });
  if (matches.length > 1) return make({ support: 'ambiguous', reason: 'repeated_match' });

  const startTokenIndex = matches[0];
  const endTokenIndex = startTokenIndex + quoteTokens.length - 1;
  return make({
    support: 'supported',
    reason: 'exact_contiguous_match',
    startCueId: transcriptTokens[startTokenIndex].cueId,
    endCueId: transcriptTokens[endTokenIndex].cueId,
    startTokenIndex,
    endTokenIndex,
  });
}

export function createSignalAssessment(input: SignalAssessmentInput): SignalAssessment {
  assertNoSecrets(input);
  const verdicts: SignalVerdict[] = ['YES', 'OPPORTUNITY', 'MAYBE', 'NO'];
  if (!verdicts.includes(input.verdict)) throw new Error(`invalid signal verdict '${input.verdict}'`);

  const recommendations = (input.recommendations ?? []).map((recommendation) => ({
    id: requireText(recommendation.id, 'recommendation id', 200),
    text: requireText(recommendation.text, 'recommendation text', 4000),
    evidenceSpanDigests: [...new Set((recommendation.evidenceSpanDigests ?? []).map((digest) => requireDigest(digest, 'evidenceSpanDigest')))].sort(),
    policyTags: normalizeTags(recommendation.policyTags ?? []),
  })).sort((a, b) => a.id.localeCompare(b.id));

  const ids = recommendations.map((recommendation) => recommendation.id);
  if (new Set(ids).size !== ids.length) throw new Error('recommendation ids must be unique');

  const provider = input.provider ? {
    kind: input.provider.kind,
    provider: requireText(input.provider.provider, 'provider.provider', 200),
    ...(input.provider.model ? { model: requireText(input.provider.model, 'provider.model', 200) } : {}),
    ...(input.provider.revision ? { revision: requireText(input.provider.revision, 'provider.revision', 200) } : {}),
  } : undefined;
  if (provider && !['agent', 'local', 'api', 'deterministic'].includes(provider.kind)) {
    throw new Error(`invalid provider kind '${provider.kind}'`);
  }

  const base = {
    sourceEvidenceId: requireText(input.sourceEvidenceId, 'sourceEvidenceId', 500),
    projectContextDigest: requireDigest(input.projectContextDigest, 'projectContextDigest'),
    policyVersion: requireText(input.policyVersion, 'policyVersion', 200),
    verdict: input.verdict,
    recommendations,
    unknowns: uniqueSorted(input.unknowns ?? [], 'unknown', 2000),
    ...(provider ? { provider } : {}),
  };
  const digest = canonicalDigest(base);
  return {
    kind: 'signal-assessment/v1',
    ...base,
    assessmentId: `sig_${digest.slice(0, 20)}`,
    digest,
  };
}

function createCandidate(kind: SignalCandidate['kind'], input: CandidateInput): SignalCandidate {
  assertNoSecrets(input);
  const projectId = requireText(input.projectId, 'projectId', 200);
  const workstreamId = input.workstreamId ? requireText(input.workstreamId, 'workstreamId', 200) : undefined;
  const text = requireText(input.text, 'candidate text', 4000);
  const evidenceSpanDigests = [...new Set((input.evidenceSpanDigests ?? []).map((digest) => requireDigest(digest, 'evidenceSpanDigest')))].sort();
  const originAssessmentDigests = [...new Set((input.originAssessmentDigests ?? []).map((digest) => requireDigest(digest, 'originAssessmentDigest')))].sort();
  const policyTags = normalizeTags(input.policyTags ?? []);
  const comparableText = tokens(text).join(' ');
  if (!comparableText) throw new Error('candidate text has no comparable tokens');

  const dedupeKey = canonicalDigest({ kind, projectId, workstreamId, comparableText, policyTags });
  const base = {
    projectId,
    ...(workstreamId ? { workstreamId } : {}),
    text,
    evidenceSpanDigests,
    originAssessmentDigests,
    policyTags,
    promotionState: 'draft' as const,
    authority: 'proposal_only' as const,
    dedupeKey,
  };
  const digest = canonicalDigest({ kind, ...base });
  return {
    kind,
    ...base,
    candidateId: `${kind.startsWith('action') ? 'act' : 'idea'}_${dedupeKey.slice(0, 20)}`,
    digest,
  };
}

export function createActionCandidate(input: CandidateInput): SignalCandidate {
  return createCandidate('action-candidate/v1', input);
}

export function createIdeaCandidate(input: CandidateInput): SignalCandidate {
  return createCandidate('idea-candidate/v1', input);
}

export function checkCandidatePolicy(
  context: ProjectContextSnapshot,
  candidate: SignalCandidate,
  beforeVerdict: SignalVerdict,
): PolicyCheckReceipt {
  assertNoSecrets({ context, candidate });
  const candidateTags = new Set(candidate.policyTags);
  const matched = context.standingDecisions.filter((decision) => decision.tags.some((tag) => candidateTags.has(tag)));
  const forbidden = matched.filter((decision) => decision.effect === 'forbid');
  const review = matched.filter((decision) => decision.effect === 'review');
  const allowed = matched.filter((decision) => decision.effect === 'allow');

  let result: PolicyCheckResult = 'allow';
  let reason: PolicyCheckReceipt['reason'] = 'no_policy_match';
  let afterVerdict = beforeVerdict;

  if (forbidden.length) {
    result = 'reject';
    reason = 'forbidden';
    afterVerdict = 'NO';
  } else if (review.length) {
    const positive = beforeVerdict === 'YES' || beforeVerdict === 'OPPORTUNITY';
    result = positive ? 'demote' : 'review';
    reason = 'review_required';
    afterVerdict = positive ? 'MAYBE' : beforeVerdict;
  } else if (allowed.length) {
    result = 'allow';
    reason = 'explicit_allow';
  }

  const base = {
    candidateId: candidate.candidateId,
    policySetDigest: context.policyDigest,
    matchedDecisionIds: matched.map((decision) => decision.id).sort(),
    result,
    reason,
    beforeVerdict,
    afterVerdict,
  };
  return { kind: 'policy-check-receipt/v1', ...base, digest: canonicalDigest(base) };
}

export function evaluateCandidatePromotion(
  candidate: SignalCandidate,
  evidenceSpans: EvidenceSpan[],
  policyReceipt: PolicyCheckReceipt,
): PromotionEvaluation {
  if (policyReceipt.candidateId !== candidate.candidateId) {
    return { eligible: false, reason: 'receipt_mismatch', authority: 'proposal_only' };
  }
  if (!candidate.evidenceSpanDigests.length) {
    return { eligible: false, reason: 'missing_evidence', authority: 'proposal_only' };
  }
  const evidenceByDigest = new Map(evidenceSpans.map((span) => [span.digest, span]));
  const requiredEvidence = candidate.evidenceSpanDigests.map((digest) => evidenceByDigest.get(digest));
  if (requiredEvidence.some((span) => !span)) {
    return { eligible: false, reason: 'missing_evidence', authority: 'proposal_only' };
  }
  if (requiredEvidence.some((span) => span?.support !== 'supported')) {
    return { eligible: false, reason: 'unsupported_evidence', authority: 'proposal_only' };
  }
  if (policyReceipt.result !== 'allow') {
    return { eligible: false, reason: 'policy_not_clear', authority: 'proposal_only' };
  }
  return { eligible: true, reason: 'eligible', authority: 'proposal_only' };
}
