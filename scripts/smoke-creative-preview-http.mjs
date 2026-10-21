import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

async function request(path, method = 'GET', payload) {
  const response = await fetch(base + path, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return { status: response.status, result: await response.json() };
}

const created = await request('/api/v1/brand-assets', 'POST', {
  type: 'IMAGE',
  name: 'REA Creative Preview Local Smoke Product',
  url: 'https://example.org/smoke-product.png',
  tags: ['rea', 'smoke'],
});
assert.equal(created.status, 201, JSON.stringify(created.result));
assert.equal(created.result.ok, true);
const assetId = created.result.data.id;
assert.match(assetId, /^[A-Za-z0-9_-]+$/);

function payload() {
  return {
    product: {
      name: 'Demo Tumbler',
      assetId,
      visualAnchors: ['matte purple body', 'silver lid'],
      claims: [{ text: 'The lid can be removed', sourceUrl: 'https://example.org/product-docs' }],
    },
    brief: {
      format: 'ugc', audience: 'commuters', objective: 'awareness',
      channel: 'instagram', durationSeconds: 30,
    },
  };
}
const first = await request('/api/v1/creative-production/preview', 'POST', payload());
assert.equal(first.status, 200, JSON.stringify(first.result));
assert.equal(first.result.data.shots.length, 2);
assert.equal(first.result.data.controls.generationAllowed, false);
assert.equal(first.result.data.controls.publishingAllowed, false);
assert.equal(first.result.data.controls.quote.estimatedUsd, null);
assert.equal(first.result.data.shots[0].productAssetId, assetId);

const second = await request('/api/v1/creative-production/preview', 'POST', payload());
assert.equal(second.status, 200);
assert.equal(first.result.data.previewId, second.result.data.previewId);

const missingAsset = payload();
missingAsset.product.assetId = 'not_an_owned_asset';
const denied = await request('/api/v1/creative-production/preview', 'POST', missingAsset);
assert.equal(denied.status, 404);
assert.equal(denied.result.ok, false);

const untrustedEvidence = payload();
untrustedEvidence.product.claims[0].sourceUrl = 'http://127.0.0.1/private';
const rejected = await request('/api/v1/creative-production/preview', 'POST', untrustedEvidence);
assert.equal(rejected.status, 422);
assert.equal(rejected.result.code, 'INVALID_EVIDENCE');

console.log('CREATIVE_HTTP_SMOKE_PASS: owner-scoped preview, deterministic replay, invalid asset and unsafe URL rejection');
