'use strict';
// REA clean-room implementation inspired by public workflow architecture only.
// No network calls, model credentials, publication or mutable global article buffer.
const crypto = require('node:crypto');
const approval = require('./approval');
const SCHEMA = 'creator-seo-article/v1';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function fail(code, message) { const e = new Error(message); e.code = code; e.status = 400; throw e; }
function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
function url(value) {
  let parsed;
  try { parsed = new URL(String(value || '')); } catch { fail('INVALID_SOURCE_URL', 'Sources require absolute HTTPS URLs.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password ||
      /^(localhost|.+\.localhost|.+\.local|127\..*|10\..*|192\.168\..*|169\.254\..*)$/i.test(parsed.hostname)) {
    fail('INVALID_SOURCE_URL', 'Source must have a public HTTPS origin without credentials.');
  }
  parsed.hash = '';
  return parsed.toString();
}
function normalize(input) {
  const workspaceId = text(input.workspaceId, 120);
  const topic = text(input.topic, 500);
  const keyword = text(input.keyword, 180);
  const audience = text(input.audience, 1000);
  const voice = text(input.voice, 800);
  if (!workspaceId || !topic || !keyword || !audience) fail('INPUT_REQUIRED', 'workspaceId, topic, keyword and audience are required.');
  if (!Array.isArray(input.sources) || input.sources.length < 2 || input.sources.length > 40) fail('SOURCE_COUNT', 'Provide 2–40 distinct evidence sources.');
  const sources = input.sources.map((s, i) => ({
    id: text(s.id, 100),
    title: text(s.title, 300),
    url: url(s.url),
    excerpt: text(s.excerpt, 3000),
    publishedAt: s.publishedAt ? text(s.publishedAt, 40) : null,
    verified: false
  }));
  if (sources.some(s => !s.id || !s.title || !s.excerpt)) fail('SOURCE_FIELDS', 'Every source needs id, title, URL and an excerpt.');
  if (new Set(sources.map(s => s.id)).size !== sources.length || new Set(sources.map(s => s.url)).size !== sources.length) fail('DUPLICATE_SOURCE', 'Evidence IDs and URLs must be distinct.');
  const raw = input.outline || {};
  const outline = {
    title: text(raw.title, 250),
    metaDescription: text(raw.metaDescription, 180),
    sections: Array.isArray(raw.sections) ? raw.sections.map(s => ({
      id: text(s.id, 100),
      heading: text(s.heading, 250),
      sourceIds: Array.isArray(s.sourceIds) ? [...new Set(s.sourceIds.map(x => text(x, 100)))].slice(0, 12) : []
    })) : []
  };
  if (!outline.title || outline.sections.length < 2 || outline.sections.length > 12) fail('OUTLINE_REQUIRED', 'Outline needs a title and 2–12 sections.');
  const ids = new Set(sources.map(s => s.id));
  if (new Set(outline.sections.map(s => s.id)).size !== outline.sections.length) fail('DUPLICATE_SECTION', 'Section IDs must be distinct.');
  for (const s of outline.sections) {
    if (!s.id || !s.heading || !s.sourceIds.length || s.sourceIds.some(id => !ids.has(id))) fail('UNCITED_OUTLINE', 'Each section must reference valid source IDs.');
  }
  const contract = {schema: SCHEMA, workspaceId, topic, keyword, audience, voice, sources, outline};
  const runId = 'seo_' + hash(contract).slice(0, 24);
  const outlineReviewText = JSON.stringify({schema: 'seo-outline-review/v1', runId, outline, sources});
  return {contract, runId, outlineReviewText};
}
function markdownLinks(body) {
  const matches = [];
  const rx = /\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\)/g;
  for (const m of String(body || '').matchAll(rx)) matches.push(m[1]);
  return matches;
}
function checkSection(section, body, sourceMap) {
  const issues = [];
  const content = text(body, 22000);
  if (content.split(/\s+/).filter(Boolean).length < 30) issues.push('SECTION_TOO_SHORT');
  const links = markdownLinks(content);
  const allowed = new Set(section.sourceIds.map(id => sourceMap.get(id).url));
  let covered = false;
  for (const link of links) {
    let normalized;
    try { normalized = url(link); } catch { issues.push('INVALID_CITATION_URL'); continue; }
    if (!allowed.has(normalized)) issues.push('UNAPPROVED_CITATION');
    else covered = true;
  }
  if (!covered) issues.push('SECTION_CITATION_MISSING');
  if (/\bI (?:personally )?(?:tested|benchmarked|built|measured)\b/i.test(content)) issues.push('FIRST_PERSON_CLAIM_REVIEW');
  return {passed: issues.length === 0, issues: [...new Set(issues)], citations: links.length, text: content};
}
async function run(input = {}, adapters = {}) {
  const {contract, runId, outlineReviewText} = normalize(input);
  const states = ['INPUT_VALIDATED', 'OUTLINE_PREPARED'];
  const base = {schema: SCHEMA, runId, status: 'outline-approval-required', publish: false,
    outline: contract.outline, sources: contract.sources, outlineReviewText, states};
  const signed = input.outlineApproval;
  const approvalCheck = approval.verify(signed, {draft: outlineReviewText, platform: 'seo-outline'}, adapters.approvalSecret);
  if (!signed || signed.runId !== runId || !approvalCheck.passed) {
    return {...base, approvalErrors: signed ? [...approvalCheck.errors, ...(signed.runId !== runId ? ['RUN_ID_MISMATCH'] : [])] : ['OUTLINE_REVIEW_REQUIRED'],
      receipt: {schema: 'seo-run-receipt/v1', runId, status: base.status, contentHash: hash(contract), sourcesVerified: false, externalWrites: 0}};
  }
  states.push('OUTLINE_APPROVED');
  const supplied = input.sectionDrafts && typeof input.sectionDrafts === 'object' ? input.sectionDrafts : null;
  if (!supplied && typeof adapters.writeSection !== 'function') {
    return {...base, status: 'model-not-configured', states, receipt: {schema: 'seo-run-receipt/v1', runId, status: 'model-not-configured', sourcesVerified: false, externalWrites: 0}};
  }
  const sourceMap = new Map(contract.sources.map(s => [s.id, s]));
  const sections = [], checks = [];
  for (const section of contract.outline.sections) {
    const draft = supplied ? supplied[section.id] : await adapters.writeSection({
      runId, workspaceId: contract.workspaceId, topic: contract.topic, keyword: contract.keyword,
      audience: contract.audience, voice: contract.voice, section,
      // Only selected evidence is passed to a caller-supplied model adapter.
      evidence: section.sourceIds.map(id => sourceMap.get(id))
    });
    const check = checkSection(section, draft, sourceMap);
    sections.push({id: section.id, heading: section.heading, markdown: check.text, sourceIds: section.sourceIds});
    checks.push({id: section.id, passed: check.passed, issues: check.issues, citationCount: check.citations});
  }
  states.push('SECTIONS_DRAFTED', 'CITATIONS_CHECKED');
  const ok = checks.every(c => c.passed);
  const article = ok ? '# ' + contract.outline.title + '\n\n' + sections.map(s => '## ' + s.heading + '\n\n' + s.markdown).join('\n\n') : null;
  const status = ok ? 'editorial-review-required' : 'quality-failed';
  states.push(ok ? 'EDITORIAL_APPROVAL_REQUIRED' : 'QUALITY_FAILED');
  const receipt = {schema: 'seo-run-receipt/v1', runId, status, contentHash: article ? hash(article) : null,
    contractHash: hash(contract), sourceIds: contract.sources.map(s => s.id),
    sectionChecks: checks, sourcesVerified: false, externalWrites: 0};
  return {...base, status, states, checks, sections, article, publish: false,
    imagePrompts: [], receipt, note: 'Sources and factual claims are user-provided and still require independent editorial verification.'};
}
module.exports = {SCHEMA, normalize, checkSection, markdownLinks, run};
