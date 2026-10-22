import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFilmPlan, FilmPlanError, validateFilmPlan } from './film-plan.mjs';

const plan = {
  name: 'Demo from agent', format: 'portrait',
  scenes: [{
    id: 'intro', name: 'Intro', duration: 5,
    narration: 'Our app ships faster with agents.',
    background: '#101820',
    layers: [
      { id: 'title', type: 'text', text: 'FilmPlan demo', start: 0, end: 4.5,
        bounds: { x: 0.1, y: 0.2, width: 0.8, height: 0.3 }, color: '#FFFFFF', fontSize: 96 },
      { id: 'accent', type: 'shape', fill: '#D7FF64', start: 1, end: 5,
        bounds: { x: 0.1, y: 0.6, width: 0.8, height: 0.025 } },
    ],
  }],
};

test('compiles identical plans to reproducible template data and digest', () => {
  const a = compileFilmPlan(plan);
  const b = compileFilmPlan(plan);
  assert.deepEqual(a, b);
  assert.equal(a.planHash.length, 64);
  assert.equal(a.document.pages[0].videoDuration, 5);
  assert.equal(a.document.pages[0].elements[0].transitions.hideAt, 4.5);
  assert.deepEqual(a.document.pages[0].elements[1].position, { x: 108, y: 1152 });
  assert.equal(a.document.pages[0].audioTracks[0].tts.text, plan.scenes[0].narration);
  assert.equal(a.document.pages[0].subtitle.enabled, true);
});

test('accepts square and landscape while staying within the canvas', () => {
  for (const format of ['square', 'landscape']) {
    const result = compileFilmPlan({ ...plan, format });
    const canvas = result.document.pages[0].canvas;
    for (const layer of result.document.pages[0].elements) {
      assert.ok(layer.position.x + layer.dimensions.width <= canvas.width);
      assert.ok(layer.position.y + layer.dimensions.height <= canvas.height);
    }
  }
});

test('rejects duplicate IDs, invalid timing, nonfinite geometry, unsafe sources and huge films', () => {
  const copy = () => structuredClone(plan);
  const duplicate = copy(); duplicate.scenes[0].layers[1].id = 'title';
  assert.throws(() => validateFilmPlan(duplicate), FilmPlanError);
  const badRange = copy(); badRange.scenes[0].layers[0].end = 6;
  assert.throws(() => validateFilmPlan(badRange), FilmPlanError);
  const badBox = copy(); badBox.scenes[0].layers[0].bounds.x = 0.9;
  assert.throws(() => validateFilmPlan(badBox), FilmPlanError);
  const nonfinite = copy(); nonfinite.scenes[0].duration = Number.NaN;
  assert.throws(() => validateFilmPlan(nonfinite), FilmPlanError);
  const media = copy(); media.scenes[0].layers[0].type = 'video'; media.scenes[0].layers[0].src = 'http://127.0.0.1/private';
  assert.throws(() => validateFilmPlan(media), FilmPlanError);
  const long = copy(); long.scenes = Array.from({ length: 5 }, (_, i) => ({ ...copy().scenes[0], id: 'scene' + i, duration: 45, layers: [{ ...copy().scenes[0].layers[0], end: 45 }] }));
  assert.throws(() => validateFilmPlan(long), FilmPlanError);
});

test('malicious text remains inert text data, never evaluated or inserted as HTML', () => {
  const payload = structuredClone(plan);
  payload.scenes[0].layers[0].text = '<script>alert(1)</script>';
  const result = compileFilmPlan(payload);
  assert.equal(result.document.pages[0].elements[0].content, '<script>alert(1)</script>');
  assert.equal(result.document.pages[0].elements[0].type, 'text');
  assert.ok(!Object.hasOwn(result.document.pages[0].elements[0], 'html'));
});
