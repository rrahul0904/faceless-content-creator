import test from 'node:test';
import assert from 'node:assert/strict';
import { previewCreativeProduction, CreativePreviewError } from '../lib/creative-production/preview.ts';

function fixture() {
  return {
    product: {
      name: 'Example Tumbler',
      assetId: 'brand_asset_123',
      visualAnchors: ['matte purple body', 'silver lid'],
      claims: [{ text: 'The tumbler has a removable lid', sourceUrl: 'https://example.org/products/tumbler' }],
    },
    brief: { format: 'ugc', audience: 'commuters', objective: 'awareness',
      channel: 'instagram', durationSeconds: 30 },
  };
}
function checkError(value, code) {
  assert.throws(() => previewCreativeProduction('workspace-a', value),
    error => error instanceof CreativePreviewError && error.code === code);
}
test('zero-spend deterministic replay with same tenant and input', () => {
  const a = previewCreativeProduction('workspace-a', fixture());
  const b = previewCreativeProduction('workspace-a', fixture());
  assert.deepEqual(a, b);
  assert.match(a.previewId, /^creative-v1-[a-f0-9]{64}$/);
  assert.equal(a.controls.generationAllowed, false);
  assert.equal(a.controls.publishingAllowed, false);
  assert.equal(a.controls.paidMediaCallsMade, 0);
  assert.equal(a.controls.quote.estimatedUsd, null);
  assert.equal(a.evidenceStatus, 'user-supplied-links-not-independently-verified');
});
test('workspace boundary is included in hash', () => {
  const a = previewCreativeProduction('workspace-a', fixture());
  const b = previewCreativeProduction('workspace-b', fixture());
  assert.notEqual(a.previewId, b.previewId);
});
test('every shot locks product asset and anchors; timing covers duration', () => {
  const value = previewCreativeProduction('workspace-a', fixture());
  assert.equal(value.shots.length, 2);
  assert.deepEqual(value.shots.map(s => [s.startSeconds, s.endSeconds]), [[0, 15], [15, 30]]);
  assert(value.shots.every(s => s.productAssetId === 'brand_asset_123'));
  assert(value.shots.every(s => s.actorPolicy === 'synthetic-only'));
  assert(value.shots.every(s => s.visualAnchors[0] === 'matte purple body'));
  assert.equal(value.shots[0].evidence[0].sourceUrl, 'https://example.org/products/tumbler');
});
test('single and long clips are deterministic and no more than 15 seconds', () => {
  for (const duration of [15, 30, 45, 60]) {
    const x = fixture();
    x.brief.durationSeconds = duration;
    const out = previewCreativeProduction('workspace-a', x);
    assert.equal(out.shots.length, duration / 15);
    assert.equal(out.shots.at(-1).endSeconds, duration);
    assert(out.shots.every(s => s.endSeconds - s.startSeconds <= 15));
  }
});
test('empty evidence is rejected instead of invented', () => {
  const value = fixture(); value.product.claims = [];
  checkError(value, 'UNSUPPORTED_CLAIMS');
});
test('non-public, plaintext, embedded-credential and invalid evidence URLs are rejected', () => {
  for (const sourceUrl of ['http://example.org/x', 'https://127.0.0.1/x',
    'https://user:pass@example.org/x', 'https://localhost/x', 'https://example.local/x',
    'https://example.org:8443/x', 'not-a-url']) {
    const value = fixture(); value.product.claims[0].sourceUrl = sourceUrl;
    checkError(value, 'INVALID_EVIDENCE');
  }
});
test('asset ID cannot be a path or URL', () => {
  for (const assetId of ['../../secret', 'https://example.org/a', '/tmp/file']) {
    const value = fixture(); value.product.assetId = assetId;
    checkError(value, 'INVALID_ASSET');
  }
});
test('anchors must be user-supplied and distinct', () => {
  const a = fixture(); a.product.visualAnchors = [];
  checkError(a, 'INVALID_ANCHORS');
  const b = fixture(); b.product.visualAnchors = ['purple', 'purple'];
  checkError(b, 'INVALID_ANCHORS');
});
test('unrecognized formats and duration cannot silently fall back', () => {
  const a = fixture(); a.brief.format = 'celebrity-impersonation';
  checkError(a, 'INVALID_FORMAT');
  const b = fixture(); b.brief.durationSeconds = 240;
  checkError(b, 'INVALID_DURATION');
});
test('evidence change changes content address', () => {
  const a = previewCreativeProduction('workspace-a', fixture());
  const b = fixture();
  b.product.claims[0].text = 'The lid is detachable';
  assert.notEqual(a.previewId, previewCreativeProduction('workspace-a', b).previewId);
});
