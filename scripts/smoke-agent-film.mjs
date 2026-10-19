// Runs against the already booted local app in CI. Does not consume render-job quota.
import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const token = process.env.SMOKE_API_KEY ?? '';
const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
const plan = {
  name: 'REA FilmPlan smoke',
  format: 'square',
  scenes: [{
    id: 'smoke_scene', duration: 3,
    narration: 'An agent created this editable scene.',
    layers: [
      { id: 'headline', type: 'text', text: 'Readable by humans', start: 0, end: 2.8, bounds: { x: 0.1, y: 0.25, width: 0.8, height: 0.3 } },
      { id: 'bar', type: 'shape', fill: '#D7FF64', start: 1, end: 3, bounds: { x: 0.1, y: 0.66, width: 0.8, height: 0.02 } },
    ],
  }],
};
async function post(body, requestHeaders = headers) {
  const response = await fetch(base + '/api/v1/agent-films', { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

const dry = await post({ plan, dryRun: true });
assert.equal(dry.status, 200, JSON.stringify(dry.body));
assert.equal(dry.body.data.duration, 3);
assert.equal(dry.body.data.document.canvasWidth, 1080);
assert.equal(dry.body.data.document.pages[0].elements[0].content, 'Readable by humans');
assert.equal(dry.body.data.document.pages[0].audioTracks[0].tts.text, plan.scenes[0].narration);

const replay = await post({ plan, dryRun: true });
assert.equal(replay.body.data.planHash, dry.body.data.planHash);
const bad = structuredClone(plan);
bad.scenes[0].layers[0].end = 9;
const denied = await post({ plan: bad, dryRun: true });
assert.equal(denied.status, 400);
const forbidden = await post({ plan: { ...plan, scenes: [{ ...plan.scenes[0], layers: [{ ...plan.scenes[0].layers[0], type: 'video', src: 'http://169.254.169.254/latest' }] }] }, dryRun: true });
assert.equal(forbidden.status, 400);

const created = await post({ plan });
assert.equal(created.status, 201, JSON.stringify(created.body));
assert.ok(created.body.data.templateId);
assert.equal(created.body.data.planHash, dry.body.data.planHash);
const savedResponse = await fetch(base + '/api/v1/templates/' + encodeURIComponent(created.body.data.templateId), { headers });
assert.equal(savedResponse.status, 200);
const saved = await savedResponse.json();
assert.equal(saved.data.document.pages[0].elements[0].transitions.hideAt, 2.8);
assert.equal(saved.data.document.pages[0].videoDuration, 3);

const anonymous = await post({ plan, dryRun: true }, { 'Content-Type': 'application/json', Authorization: 'Bearer fcc_invalid_key_for_smoke_test' });
assert.equal(anonymous.status, 401);
console.log(JSON.stringify({ success: true, templateId: created.body.data.templateId, sha256: dry.body.data.planHash }));
