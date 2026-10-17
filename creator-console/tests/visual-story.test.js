'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planVisualStory,inferFormat,splitItems}=require('../lib/visual-story');

test('infers architecture and preserves structured prompt steps',()=>{
  const prompt='RAG pipeline: ingest -> chunk -> embed -> retrieve -> answer';
  assert.equal(inferFormat(prompt),'architecture');
  assert.deepEqual(splitItems(prompt).map(x=>x.label),['ingest','chunk','embed','retrieve','answer']);
});

test('builds LinkedIn portrait spec with source-only provenance',()=>{
  const spec=planVisualStory({prompt:'Launch phases: Research -> Build -> Verify',motion:'build',brand:{name:'Test'}});
  assert.equal(spec.width,1080);assert.equal(spec.height,1350);assert.equal(spec.motion,'build');assert.equal(spec.brand.name,'Test');assert.equal(spec.items.length,3);assert.equal(spec.provenance.claimsPolicy,'source-only');
});

test('rejects an empty prompt',()=>{
  assert.throws(()=>planVisualStory({prompt:'   '}),/PROMPT_REQUIRED/);
});
