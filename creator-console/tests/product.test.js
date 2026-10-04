'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const today=require('../data/today.json');
const productResearch=require('../data/product-research.json');

test('today feed is backed by explicit primary-source metadata',()=>{
  assert.ok(today.length>=4);
  for(const item of today){
    assert.ok(item.id);
    assert.ok(item.topic);
    assert.match(item.sourceUrl,/^https:\/\//);
    assert.match(item.publishedAt,/^2026-/);
    assert.equal(item.signals.evidence,5);
    assert.ok(Array.isArray(item.angleSuggestions)&&item.angleSuggestions.length>=2);
  }
});

test('product research records decisions instead of copying reddit products',()=>{
  assert.equal(productResearch.schema,'creator-product-research/v1');
  assert.ok(productResearch.principles.length>=5);
  for(const p of productResearch.principles){
    assert.ok(p.insight);
    assert.ok(p.productDecision);
    assert.ok(Array.isArray(p.sources)&&p.sources.length>0);
  }
});
