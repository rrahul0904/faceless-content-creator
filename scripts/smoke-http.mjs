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

const health = await waitForHealth();
const scriptResponse = await json('/api/script', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    niche: 'technology',
    idea: 'Why local-first software keeps working when cloud services are unavailable',
  }),
});

const draft = scriptResponse.result;
if (!draft?.hook || !draft?.script || !draft?.caption || !draft?.topic) {
  throw new Error(`Script endpoint returned an incomplete draft: ${JSON.stringify(scriptResponse)}`);
}

const renderResponse = await json('/api/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...draft,
    voice: 'en-us',
    speechRate: 185,
    template: 'editorial',
  }),
});

const jobId = renderResponse.job?.id;
if (!jobId) throw new Error(`Render endpoint returned no job id: ${JSON.stringify(renderResponse)}`);

let finished;
for (let attempt = 0; attempt < 80; attempt += 1) {
  const status = await json(`/api/render/${encodeURIComponent(jobId)}`);
  if (status.job?.finished) {
    finished = status.job;
    break;
  }
  await sleep(1000);
}

if (!finished || finished.status !== 'succeeded') {
  throw new Error(`Render did not succeed: ${JSON.stringify(finished)}`);
}

const videoPath = finished.result?.data?.content;
if (!videoPath) throw new Error('Completed render has no video URL');

const videoResponse = await fetch(`${baseUrl}${videoPath}`, {
  headers: { Range: 'bytes=0-65535' },
});
if (videoResponse.status !== 206) {
  throw new Error(`MP4 range request returned ${videoResponse.status}, expected 206`);
}
if (!videoResponse.headers.get('content-type')?.startsWith('video/mp4')) {
  throw new Error(`Unexpected video content type: ${videoResponse.headers.get('content-type')}`);
}
const videoBytes = new Uint8Array(await videoResponse.arrayBuffer());
if (videoBytes.length < 1024) {
  throw new Error(`MP4 response was unexpectedly small: ${videoBytes.length} bytes`);
}

console.log(JSON.stringify({
  ok: true,
  health,
  jobId,
  renderStatus: finished.status,
  videoPath,
  sampledVideoBytes: videoBytes.length,
}));
