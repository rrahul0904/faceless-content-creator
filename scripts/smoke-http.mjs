const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const body = await response.json();
        if (body.ok && body.dependencies?.database && body.dependencies?.ffmpeg && body.dependencies?.ffprobe && body.dependencies?.tts) {
          return body;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw lastError ?? new Error('Application did not become healthy');
}

async function assertVideo(videoPath) {
  const videoResponse = await fetch(`${baseUrl}${videoPath}`, { headers: { Range: 'bytes=0-65535' } });
  if (videoResponse.status !== 206) throw new Error(`MP4 range request returned ${videoResponse.status}, expected 206`);
  if (!videoResponse.headers.get('content-type')?.startsWith('video/mp4')) {
    throw new Error(`Unexpected video content type: ${videoResponse.headers.get('content-type')}`);
  }
  const bytes = new Uint8Array(await videoResponse.arrayBuffer());
  if (bytes.length < 1024) throw new Error(`MP4 response was unexpectedly small: ${bytes.length} bytes`);
  return bytes.length;
}

async function waitLegacyRender(jobId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const status = await json(`/api/render/${encodeURIComponent(jobId)}`);
    if (status.job?.finished) return status.job;
    await sleep(1000);
  }
  throw new Error(`Legacy render ${jobId} did not finish`);
}

async function waitTemplateRender(jobId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const status = await json(`/api/v1/render-jobs/${encodeURIComponent(jobId)}`);
    if (status.data?.finished) return status.data;
    await sleep(1000);
  }
  throw new Error(`Template render ${jobId} did not finish`);
}

const health = await waitForHealth();

// Compatibility path remains functional while the generic template engine is developed.
const scriptResponse = await json('/api/script', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ niche: 'technology', idea: 'Why local-first software keeps working when cloud services are unavailable' }),
});
const draft = scriptResponse.result;
if (!draft?.hook || !draft?.script || !draft?.caption || !draft?.topic) {
  throw new Error(`Script endpoint returned an incomplete draft: ${JSON.stringify(scriptResponse)}`);
}
const legacyQueued = await json('/api/render', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...draft, voice: 'en-us', speechRate: 185, template: 'editorial' }),
});
const legacyJobId = legacyQueued.job?.id;
if (!legacyJobId) throw new Error(`Render endpoint returned no job id: ${JSON.stringify(legacyQueued)}`);
const legacyFinished = await waitLegacyRender(legacyJobId);
if (legacyFinished.status !== 'succeeded') throw new Error(`Legacy render failed: ${JSON.stringify(legacyFinished)}`);
const legacyVideoPath = legacyFinished.result?.data?.content;
if (!legacyVideoPath) throw new Error('Completed legacy render has no video URL');
const legacyBytes = await assertVideo(legacyVideoPath);

// Orshot-class path: seed template gallery, inspect parameter contract, render with dynamic modifications.
const bootstrap = await json('/api/v1/templates/bootstrap', { method: 'POST' });
const templateId = bootstrap.data?.[0]?.id;
if (!templateId) throw new Error(`Template bootstrap returned no template: ${JSON.stringify(bootstrap)}`);

const templateResponse = await json(`/api/v1/templates/${encodeURIComponent(templateId)}`);
const modContract = templateResponse.data?.document?.modifications;
if (!Array.isArray(modContract) || !modContract.some((item) => item.key === 'hook') || !modContract.some((item) => item.key === 'voiceover')) {
  throw new Error(`Template parameter contract is incomplete: ${JSON.stringify(modContract)}`);
}

const templateQueued = await json(`/api/v1/templates/${encodeURIComponent(templateId)}/render`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modifications: {
      topic: 'OCEAN INTELLIGENCE',
      hook: 'An octopus has three hearts — and two stop beating when it swims.',
      stat_number: '3',
      stat_label: 'hearts in an octopus',
      handle: '@facelesslab',
      voiceover: 'An octopus has three hearts. Two pump blood to the gills, while the third sends blood around the body. Even stranger, the main heart stops beating when the octopus swims.',
      'accent.fill': '#67E8F9',
      'hook.style.fontSize': 74,
    },
    response: { format: 'mp4', mode: 'async', size: { width: 720, height: 1280 } },
  }),
});
const templateJobId = templateQueued.data?.jobId;
if (!templateJobId) throw new Error(`Template render returned no job id: ${JSON.stringify(templateQueued)}`);
const templateFinished = await waitTemplateRender(templateJobId);
if (templateFinished.status !== 'succeeded') throw new Error(`Template render failed: ${JSON.stringify(templateFinished)}`);
const templateVideoPath = templateFinished.result?.url;
if (!templateVideoPath) throw new Error('Completed template render has no video URL');
const templateBytes = await assertVideo(templateVideoPath);

const history = await json(`/api/v1/render-jobs?templateId=${encodeURIComponent(templateId)}&limit=10`);
if (!history.data?.some((job) => job.id === templateJobId)) throw new Error('Template render was not present in render history');

console.log(JSON.stringify({
  ok: true,
  health,
  legacy: { jobId: legacyJobId, videoPath: legacyVideoPath, sampledVideoBytes: legacyBytes },
  templateEngine: { templateId, jobId: templateJobId, videoPath: templateVideoPath, sampledVideoBytes: templateBytes },
}));
