import { access, stat } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_AVATAR_SERVICE = 'http://avatar-worker:8081';

export async function renderAIVideo({ jobId, input }) {
  if (input.consent !== true) throw new Error('AI presenter generation requires explicit consent');
  const serviceUrl = (process.env.AVATAR_SERVICE_URL || DEFAULT_AVATAR_SERVICE).replace(/\/$/, '');
  const response = await fetch(`${serviceUrl}/v1/presenter`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      job_id: jobId,
      image_ref: String(input.imageRef || ''),
      script: String(input.script || ''),
      voice: String(input.voice || 'af_heart'),
      consent: true,
      aspect: String(input.aspect || '9:16'),
      bbox_shift: Number(input.bboxShift || 0),
    }),
    signal: AbortSignal.timeout(35 * 60 * 1000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const detail = body?.detail ? JSON.stringify(body.detail) : JSON.stringify(body);
    throw new Error(`Avatar service failed (${response.status}): ${detail}`);
  }

  const outputFile = path.resolve(process.cwd(), 'data', 'renders', `${jobId}.mp4`);
  await access(outputFile);
  const info = await stat(outputFile);
  if (info.size < 10_000) throw new Error('Avatar service produced an unexpectedly small MP4');

  return {
    outputFile,
    videoUrl: `/api/assets/${encodeURIComponent(`${jobId}.mp4`)}`,
    bytes: info.size,
    engine: String(body.engine || 'musetalk-v1.5'),
    ttsEngine: String(body.tts_engine || 'kokoro'),
  };
}
