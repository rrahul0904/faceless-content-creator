const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3002';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function json(pathname, init = {}) {
  const { response, body } = await request(pathname, init);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const body = await response.json();
        if (body.ok && body.dependencies?.database && body.dependencies?.ffmpeg && body.dependencies?.tts) return body;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error('Workflow smoke app did not become healthy');
}

async function waitRender(jobId) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const body = await json(`/api/v1/render-jobs/${encodeURIComponent(jobId)}`);
    if (body.data?.finished) return body.data;
    await sleep(1000);
  }
  throw new Error(`Workflow render ${jobId} did not finish`);
}

async function assertVideo(videoUrl) {
  const response = await fetch(`${baseUrl}${videoUrl}`, { headers: { Range: 'bytes=0-65535' } });
  if (response.status !== 206) throw new Error(`Workflow MP4 range request returned ${response.status}`);
  if (!response.headers.get('content-type')?.startsWith('video/mp4')) {
    throw new Error(`Workflow MP4 content type was ${response.headers.get('content-type')}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error(`Workflow MP4 range was unexpectedly small: ${bytes.length}`);
  return bytes.length;
}

const health = await waitForHealth();
const capture = {
  workflowId: 'invite-team-member',
  captureId: 'ci-workflow-capture-001',
  durationMs: 6500,
  events: [
    { id: 'open-settings', kind: 'click', atMs: 500, label: 'Open team settings', target: '#team-settings' },
    { id: 'enter-email', kind: 'input', atMs: 2600, label: 'Enter teammate email', target: '[name="member-email"]' },
    { id: 'invite', kind: 'click', atMs: 4900, label: 'Invite teammate', target: '#invite-member' },
  ],
};

const queued = await json('/api/v1/workflows/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(capture),
});

const result = queued.data;
if (
  !result?.sourceRevisionId ||
  !result?.renderJobId ||
  !result?.templateId ||
  result?.videoPlan?.scenes?.length !== 3 ||
  !String(result?.guideMarkdown ?? '').includes('Open team settings') ||
  !String(result?.guideMarkdown ?? '').includes('Source event: `invite`') ||
  result?.cost?.hasUnknownRates !== true
) {
  throw new Error(`Workflow render response was incomplete: ${JSON.stringify(queued)}`);
}

const template = await json(`/api/v1/templates/${encodeURIComponent(result.templateId)}`);
if (
  template.data?.document?.pages?.length !== 3 ||
  !template.data?.document?.tags?.includes('re-375') ||
  !String(template.data?.document?.description ?? '').includes(result.sourceRevisionId)
) {
  throw new Error(`Workflow training template lost provenance: ${JSON.stringify(template.data)}`);
}

const finished = await waitRender(result.renderJobId);
if (finished.status !== 'succeeded' || !finished.result?.url) {
  throw new Error(`Workflow render did not succeed: ${JSON.stringify(finished)}`);
}
const videoBytes = await assertVideo(finished.result.url);

// Sensitive source material must fail closed before a render job is queued.
const blocked = await request('/api/v1/workflows/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...capture,
    captureId: 'ci-workflow-sensitive',
    events: [{ ...capture.events[0], sensitive: true }],
  }),
});
if (blocked.response.status !== 409 || !String(blocked.body?.error ?? '').includes('blocked pending review')) {
  throw new Error(`Sensitive workflow did not fail closed: ${blocked.response.status} ${JSON.stringify(blocked.body)}`);
}

console.log(JSON.stringify({
  ok: true,
  health: health.dependencies,
  sourceRevisionId: result.sourceRevisionId,
  renderJobId: result.renderJobId,
  templateId: result.templateId,
  steps: result.videoPlan.scenes.length,
  videoBytes,
  videoUrl: finished.result.url,
  sensitiveReviewGate: 'certified',
}));
