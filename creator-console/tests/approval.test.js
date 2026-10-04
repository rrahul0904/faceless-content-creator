'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sign,verify}=require('../lib/approval');
const SECRET='unit-test-secret-unit-test-secret';

test('signed approval verifies exact approved content',()=>{
  const r=sign({runId:'run_1',platform:'linkedin',draft:'hello world',ttlSeconds:600},SECRET);
  assert.equal(verify(r,{draft:'hello world',platform:'linkedin'},SECRET).passed,true);
});

test('publisher gate rejects content changed after approval',()=>{
  const r=sign({runId:'run_1',platform:'linkedin',draft:'approved text',ttlSeconds:600},SECRET);
  const v=verify(r,{draft:'changed text',platform:'linkedin'},SECRET);
  assert.equal(v.passed,false);
  assert.ok(v.errors.includes('APPROVED_CONTENT_CHANGED'));
});

test('publisher gate rejects platform mismatch',()=>{
  const r=sign({runId:'run_1',platform:'medium',draft:'article',ttlSeconds:600},SECRET);
  const v=verify(r,{draft:'article',platform:'linkedin'},SECRET);
  assert.equal(v.passed,false);
  assert.ok(v.errors.includes('APPROVAL_PLATFORM_MISMATCH'));
});
