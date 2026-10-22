import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFilmFrame } from './timeline.mjs';
const scenes = [
  { duration: 3, layers: [{ id: 'always' }, { id: 'late', start: 1, end: 2.5 }] },
  { duration: 2, layers: [{ id: 'second', start: 0.5, end: 1.5 }] },
];
test('empty or malformed scenes are inert and never throw', () => {
  assert.deepEqual(resolveFilmFrame([], 8).visibleLayerIds, []);
  assert.equal(resolveFilmFrame([{ duration: NaN, layers: [] }], Infinity).time, 0);
});
test('film global time maps exactly to the next scene at a cut', () => {
  assert.deepEqual(resolveFilmFrame(scenes, 3), {
    sceneIndex: 1, sceneStart: 3, localTime: 0, time: 3, totalDuration: 5, visibleLayerIds: [],
  });
  assert.deepEqual(resolveFilmFrame(scenes, 3.5).visibleLayerIds, ['second']);
});
test('showAt inclusive and hideAt exclusive; adjacent frames are deterministic', () => {
  assert.deepEqual(resolveFilmFrame(scenes, 0).visibleLayerIds, ['always']);
  assert.deepEqual(resolveFilmFrame(scenes, 1).visibleLayerIds, ['always', 'late']);
  assert.deepEqual(resolveFilmFrame(scenes, 2.5).visibleLayerIds, ['always']);
  assert.deepEqual(resolveFilmFrame(scenes, 2), resolveFilmFrame(scenes, 2));
});
test('end-of-film, negative, NaN and Infinity scrub positions clamp safely', () => {
  assert.equal(resolveFilmFrame(scenes, -50).time, 0);
  assert.equal(resolveFilmFrame(scenes, NaN).time, 0);
  assert.equal(resolveFilmFrame(scenes, Infinity).time, 0);
  const end = resolveFilmFrame(scenes, 100);
  assert.equal(end.sceneIndex, 1);
  assert.ok(end.time < 5 && end.time >= 4.999 - 1e-9);
  assert.equal(end.visibleLayerIds.length, 0);
});
test('source objects are never mutated while inspecting frames', () => {
  const before = JSON.stringify(scenes);
  resolveFilmFrame(scenes, 1.5);
  assert.equal(JSON.stringify(scenes), before);
});
