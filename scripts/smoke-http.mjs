import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function approx(value, expected, tolerance = 0.08) {
  return Number.isFinite(value) && Math.abs(value - expected) <= tolerance;
}

async function json(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
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

async function createReferenceFixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'faceless-reference-'));
  const output = path.join(dir, 'reference-fixture.mp4');
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30:d=1',
    '-f', 'lavfi', '-i', 'color=c=white:s=320x240:r=30:d=1',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30:d=1',
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[outv]',
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-movflags', '+faststart',
    output,
  ], { maxBuffer: 1024 * 1024 * 16 });
  return { dir, output };
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

// Reference-video path: create a real hard-cut MP4, upload it, detect its cuts, and bind a semantic event to the containing scene.
const referenceFixture = await createReferenceFixture();
const referenceBytes = await readFile(referenceFixture.output);
const referenceForm = new FormData();
referenceForm.append('file', new Blob([referenceBytes], { type: 'video/mp4' }), 'reference-fixture.mp4');
const uploadedReference = await json('/api/media', { method: 'POST', body: referenceForm });
const referenceFilename = uploadedReference.media?.filename;
if (!referenceFilename) throw new Error(`Reference upload returned no filename: ${JSON.stringify(uploadedReference)}`);

const referenceAnalysis = await json('/api/v1/reference-video/analyze', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: referenceFilename,
    sceneThreshold: 0.1,
    semantic: {
      words: [
        { text: 'Now', start: 1.10, end: 1.22, speaker: 'host' },
        { text: 'show', start: 1.23, end: 1.38, speaker: 'host' },
        { text: 'the', start: 1.39, end: 1.49, speaker: 'host' },
        { text: 'dashboard.', start: 1.50, end: 1.72, speaker: 'host' },
      ],
      cues: [{
        id: 'dashboard-reveal',
        target: 'accent',
        phrase: 'show the dashboard',
        speaker: 'host',
        padBefore: 0.05,
        padAfter: 0.10,
      }],
    },
  }),
});
await rm(referenceFixture.dir, { recursive: true, force: true });

const analyzedReference = referenceAnalysis.data;
const referenceEvent = analyzedReference?.semantic?.events?.[0];
if (
  analyzedReference?.video?.width !== 320 || analyzedReference?.video?.height !== 240 ||
  !approx(analyzedReference?.video?.duration, 3, 0.15) || !approx(analyzedReference?.video?.fps, 30, 0.2) ||
  analyzedReference?.video?.hasAudio !== false ||
  !Array.isArray(analyzedReference?.cuts) || analyzedReference.cuts.length < 2 ||
  !Array.isArray(analyzedReference?.scenes) || analyzedReference.scenes.length < 3 ||
  analyzedReference?.rhythm?.cutCount < 2 ||
  referenceEvent?.sceneIndex !== 1 ||
  !approx(referenceEvent?.start, 1.18, 0.02) || !approx(referenceEvent?.end, 1.82, 0.02) ||
  analyzedReference?.semantic?.modifications?.['accent.transitions.showAt'] !== referenceEvent?.start ||
  analyzedReference?.semantic?.modifications?.['accent.transitions.hideAt'] !== referenceEvent?.end
) {
  throw new Error(`Reference-video analysis was unexpected: ${JSON.stringify(referenceAnalysis)}`);
}

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

// Semantic-video path: anchor a visual window to words, then use the compiler output in a real MP4 render.
const semantic = await json('/api/v1/semantic-timeline/compile', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fps: 30,
    words: [
      { text: 'An', start: 0.00, end: 0.12, speaker: 'host' },
      { text: 'octopus', start: 0.13, end: 0.45, speaker: 'host' },
      { text: 'has', start: 0.46, end: 0.58, speaker: 'host' },
      { text: 'three', start: 0.59, end: 0.84, speaker: 'host' },
      { text: 'hearts.', start: 0.85, end: 1.10, speaker: 'host' },
    ],
    cues: [{
      id: 'accent-on-three-hearts',
      target: 'accent',
      phrase: 'three hearts',
      speaker: 'host',
      padBefore: 0.09,
      padAfter: 0.15,
    }],
  }),
});
const semanticEvent = semantic.data?.events?.[0];
const semanticModifications = semantic.data?.modifications;
if (
  semanticEvent?.wordStartIndex !== 3 || semanticEvent?.wordEndIndex !== 4 ||
  semanticEvent?.start !== 0.5 || semanticEvent?.end !== 1.25 ||
  semanticEvent?.startFrame !== 15 || semanticEvent?.endFrameExclusive !== 38 ||
  semanticModifications?.['accent.transitions.showAt'] !== 0.5 ||
  semanticModifications?.['accent.transitions.hideAt'] !== 1.25
) {
  throw new Error(`Semantic timeline compilation was unexpected: ${JSON.stringify(semantic)}`);
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
      ...semanticModifications,
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

// Cancellation is idempotent for terminal jobs; this certifies the public contract without a timing race.
const terminalCancel = await json(`/api/v1/render-jobs/${encodeURIComponent(templateJobId)}/cancel`, { method: 'POST' });
if (terminalCancel.data?.accepted !== false || terminalCancel.data?.reason !== 'already_finished' || terminalCancel.data?.status !== 'succeeded') {
  throw new Error(`Terminal render cancellation contract was unexpected: ${JSON.stringify(terminalCancel)}`);
}

console.log(JSON.stringify({
  ok: true,
  health,
  referenceVideo: {
    filename: referenceFilename,
    video: analyzedReference.video,
    cuts: analyzedReference.cuts,
    rhythm: analyzedReference.rhythm,
    semanticEvent: referenceEvent,
  },
  legacy: { jobId: legacyJobId, videoPath: legacyVideoPath, sampledVideoBytes: legacyBytes },
  semanticTimeline: {
    event: semanticEvent,
    modifications: semanticModifications,
  },
  templateEngine: {
    templateId,
    jobId: templateJobId,
    videoPath: templateVideoPath,
    sampledVideoBytes: templateBytes,
    terminalCancel,
  },
}));