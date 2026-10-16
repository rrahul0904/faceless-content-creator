'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planVisualStory}=require('../lib/visual-story');
const {certifyVisualStory}=require('../lib/visual-story-qa');

test('certifies a normal source-grounded visual story',()=>{
  const spec=planVisualStory({prompt:'RAG pipeline: ingest -> chunk -> embed -> retrieve -> answer',motion:'flow'});
  const receipt=certifyVisualStory(spec);
  assert.equal(receipt.status,'PASS');
  assert.equal(receipt.score,100);
  assert.equal(receipt.checks.every(check=>check.pass),true);
});

test('blocks low-contrast and overlong visual copy',()=>{
  const spec=planVisualStory({prompt:'Workflow: research -> build -> verify',motion:'build'});
  spec.brand.foreground='#101010';
  spec.brand.background='#111111';
  spec.items[0].label='x'.repeat(110);
  const receipt=certifyVisualStory(spec);
  assert.equal(receipt.status,'FAIL');
  assert.equal(receipt.checks.find(check=>check.id==='contrast').pass,false);
  assert.equal(receipt.checks.find(check=>check.id==='label-length').pass,false);
});
