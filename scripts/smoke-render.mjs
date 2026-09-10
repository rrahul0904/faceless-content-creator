import { stat } from 'node:fs/promises';
import { renderFacelessVideo } from '../worker/local-renderer.mjs';

const jobId = `smoke-${Date.now()}`;
const result = await renderFacelessVideo({
  jobId,
  hook: 'Zero-config render engine',
  script: 'This short video was generated locally using only open source media tools. No rendering API key was required.',
  voice: 'en-us',
  speechRate: 170,
});

const file = await stat(result.outputFile);
if (!file.isFile() || file.size < 10_000) {
  throw new Error('Smoke render did not produce a valid MP4 file');
}

console.log(JSON.stringify({ ok: true, outputFile: result.outputFile, bytes: file.size, duration: result.duration }));
