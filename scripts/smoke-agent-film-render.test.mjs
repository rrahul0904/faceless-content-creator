import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { compileFilmPlan } from '../lib/agent-film/film-plan.mjs';
import { renderTemplateVideo } from '../worker/template-renderer.mjs';

const execFileAsync = promisify(execFile);

test('a generated FilmPlan renders real, decodable, full-duration H.264 MP4 with local narration', { timeout: 120_000 }, async () => {
  const film = compileFilmPlan({
    name: 'REA proof video', format: 'square',
    scenes: [
      {
        id: 'intro', duration: 3, name: 'Intro', background: '#0D1625',
        narration: 'Hello from the local video agent.',
        layers: [
          { id: 'headline', type: 'text', text: 'VIDEO\nFROM AN AGENT', start: 0, end: 2.8, fontSize: 58,
            bounds: { x: .05, y: .2, width: .9, height: .3 } },
          { id: 'accent', type: 'shape', start: 1, end: 3, fill: '#D7FF64',
            bounds: { x: .05, y: .65, width: .9, height: .02 } },
        ],
      },
      {
        id: 'outro', duration: 3, name: 'Outro', background: '#1B2840',
        layers: [
          { id: 'cta', type: 'text', text: 'EDIT. RENDER. OWN.', start: .2, end: 2.9, fontSize: 54,
            bounds: { x: .05, y: .35, width: .9, height: .25 } },
        ],
      },
    ],
  });
  const previous = process.cwd();
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rea-film-'));
  try {
    process.chdir(temp);
    const result = await renderTemplateVideo({
      jobId: 'film-plan-proof',
      document: film.document,
      response: { size: { width: 320, height: 320 } },
    });
    const info = await stat(result.outputFile);
    assert.ok(info.size > 10_000);
    assert.equal(result.engine, 'template-engine-v1');
    assert.equal(result.pages, 2);
    assert.equal(result.duration, 6);
    assert.equal(result.width, 320);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,width,height',
      '-show_entries', 'format=duration', '-of', 'json', result.outputFile,
    ]);
    const probe = JSON.parse(stdout);
    assert.ok(probe.streams.some((stream) => stream.codec_name === 'h264' && stream.width === 320 && stream.height === 320));
    assert.ok(Math.abs(Number(probe.format.duration) - 6) <= 0.3, 'expected combined six-second output');
    console.log(JSON.stringify({ planHash: film.planHash, videoBytes: info.size, duration: probe.format.duration }));
  } finally {
    process.chdir(previous);
    await rm(temp, { recursive: true, force: true });
  }
});
