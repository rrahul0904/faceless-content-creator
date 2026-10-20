/**
 * REA fixture-only pattern ranking v0.
 * No X/network access, no scraping, no publication, no source-text copying.
 * Rank signals are exploratory and never guarantees of virality.
 */
export const VERSION = 'rea-viral-pattern-signal-v0';
export const PATTERNS = new Set(['comparison', 'checklist', 'contrarian', 'case-study', 'how-to']);

function validTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function metric(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function urlAllowed(post) {
  try {
    const u = new URL(post.sourceUrl);
    if (u.protocol !== 'https:') return false;
    if (post.origin === 'synthetic-fixture') return u.hostname === 'example.test';
    if (post.origin !== 'authorized-provider') return false;
    return ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname) &&
      /^\/[a-zA-Z0-9_]+\/status\/[0-9]+\/?$/.test(u.pathname);
  } catch { return false; }
}
function reason(post, asOfMs, niche, lookbackHours, minViews) {
  if (!post || typeof post !== 'object') return 'invalid-record';
  if (typeof post.id !== 'string' || !post.id || typeof post.niche !== 'string') return 'invalid-id-or-niche';
  if (post.niche !== niche) return 'different-niche';
  if (!urlAllowed(post)) return 'unverified-origin-or-url';
  const posted = validTime(post.postedAt);
  const observed = validTime(post.observedAt);
  if (posted === null || observed === null || posted > observed || observed > asOfMs || posted > asOfMs) return 'invalid-timestamps';
  if (asOfMs - posted > lookbackHours * 3600000) return 'outside-window';
  if (post.deleted === true) return 'deleted';
  if (post.repostOf) return 'repost';
  if (post.flags?.includes('suspected-amplification')) return 'suspicious';
  const metrics = post.metrics;
  if (!metrics || !['views', 'likes', 'replies', 'reposts', 'quotes'].every(k => metric(metrics[k]))) return 'missing-or-invalid-metrics';
  if (metrics.views < minViews) return 'insufficient-exposure';
  if (!Array.isArray(post.patterns) || !post.patterns.every(p => PATTERNS.has(p))) return 'invalid-pattern-tags';
  return null;
}

/** Pure, deterministic, source-attributed ranking for *one* niche and time window. */
export function rankPatterns(posts, { niche, asOf, lookbackHours = 168, minViews = 100 } = {}) {
  const asOfMs = validTime(asOf);
  if (!Array.isArray(posts) || typeof niche !== 'string' || !niche || asOfMs === null ||
      !Number.isInteger(lookbackHours) || lookbackHours < 1 || lookbackHours > 720 ||
      !Number.isInteger(minViews) || minViews < 100) throw new TypeError('invalid replay settings');
  // Do not retain post.body/content even if untrusted source records include it.
  const sorted = [...posts].sort((a, b) => String(a?.id).localeCompare(String(b?.id)) ||
    String(b?.observedAt).localeCompare(String(a?.observedAt)));
  const seen = new Set();
  const entries = [], rejected = [];
  for (const post of sorted) {
    const id = String(post?.id ?? '(invalid)');
    if (seen.has(id)) { rejected.push({ id, reason: 'duplicate-snapshot' }); continue; }
    seen.add(id);
    const why = reason(post, asOfMs, niche, lookbackHours, minViews);
    if (why) { rejected.push({ id, reason: why }); continue; }
    const m = post.metrics;
    const weighted = m.likes + 1.5 * m.replies + 2 * m.reposts + 1.5 * m.quotes;
    const signal = Math.round((1000 * weighted / m.views) * 100) / 100;
    const warning = m.views < 1000 ? 'small-sample' : null;
    entries.push({
      id, sourceUrl: post.sourceUrl, origin: post.origin, niche: post.niche,
      postedAt: post.postedAt, observedAt: post.observedAt, views: m.views,
      normalizedEngagementPer1000Views: signal, patterns: [...post.patterns],
      confidence: warning ? 'limited' : 'provisional',
      warnings: warning ? [warning] : [],
      scoreVersion: VERSION
    });
  }
  entries.sort((a, b) => b.normalizedEngagementPer1000Views - a.normalizedEngagementPer1000Views ||
    b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id));
  return { version: VERSION, asOf, niche, lookbackHours, syntheticOnly: entries.every(e => e.origin === 'synthetic-fixture'), entries, rejected };
}

/** Prompt suggestions contain no source post text and cannot publish anything. */
export function originalAnglePrompts(patternCard, topic) {
  if (!patternCard?.sourceUrl || !patternCard?.observedAt || !Array.isArray(patternCard.patterns) ||
      typeof topic !== 'string' || !topic.trim()) throw new TypeError('incomplete provenance or topic');
  const subject = topic.trim().slice(0, 120);
  return [
    `Explain a verifiable misconception about ${subject}, including independent technical sources.`,
    `Demonstrate a reproducible ${subject} workflow with original examples and documented limitations.`,
    `Compare two approaches to ${subject}, citing independent benchmarks and tradeoffs.`
  ];
}
