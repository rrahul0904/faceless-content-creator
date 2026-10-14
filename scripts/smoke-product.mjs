const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function json(pathname, init = {}) {
  const { response, body } = await request(pathname, init);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

const suffix = Date.now().toString(36);
const channel = await json('/api/channels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `Series smoke ${suffix}`,
    niche: 'technology',
    handle: `@smoke${suffix}`,
    voice: 'en-us',
    templateId: 'editorial',
  }),
});

if (!channel.channel?.id) throw new Error(`Channel creation returned no id: ${JSON.stringify(channel)}`);

const createdSeries = await json('/api/series', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channelId: channel.channel.id,
    name: `AI concepts ${suffix}`,
    brief: 'Explain one practical AI systems concept with a concrete example.',
    audience: 'software builders',
    cadence: 'WEEKDAYS',
    hour: 9,
    minute: 15,
    timezone: 'America/New_York',
    approvalRequired: true,
  }),
});

const series = createdSeries.series;
if (!series?.id || !series.nextRunAt || series.approvalRequired !== true || series.status !== 'ACTIVE') {
  throw new Error(`Series contract was unexpected: ${JSON.stringify(createdSeries)}`);
}

const episode = await json(`/api/series/${encodeURIComponent(series.id)}/run`, { method: 'POST' });
const content = episode.content;
if (!content?.id || content.status !== 'SCRIPTED' || !content.script || !Array.isArray(episode.visuals) || episode.visuals.length < 1) {
  throw new Error(`Series episode contract was unexpected: ${JSON.stringify(episode)}`);
}
if (!episode.visuals.every((item) => item.sourceUrl && item.query && item.sentence)) {
  throw new Error(`Visual provenance was incomplete: ${JSON.stringify(episode.visuals)}`);
}

const prematureApproval = await request(`/api/content/${encodeURIComponent(content.id)}/approve`, { method: 'POST' });
if (prematureApproval.response.status !== 409) {
  throw new Error(`Premature approval returned ${prematureApproval.response.status}, expected 409: ${JSON.stringify(prematureApproval.body)}`);
}

const forgedApproval = await request(`/api/content/${encodeURIComponent(content.id)}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'APPROVED' }),
});
if (forgedApproval.response.status !== 400) {
  throw new Error(`Generic PATCH forged APPROVED with status ${forgedApproval.response.status}: ${JSON.stringify(forgedApproval.body)}`);
}

const paused = await json(`/api/series/${encodeURIComponent(series.id)}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'PAUSED' }),
});
if (paused.series?.status !== 'PAUSED' || paused.series?.nextRunAt !== null) {
  throw new Error(`Paused series contract was unexpected: ${JSON.stringify(paused)}`);
}

console.log(JSON.stringify({
  ok: true,
  seriesId: series.id,
  contentId: content.id,
  visualBeats: episode.visuals.length,
  approvalGate: 'verified',
  nextRunAt: series.nextRunAt,
}));
