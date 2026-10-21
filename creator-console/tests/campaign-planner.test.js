'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {proposeCampaign}=require('../lib/campaign-planner');

function fixture() {
  return {
    workspaceId:'workspace-a',
    product:{url:'https://example.org/app',name:'Example App',positioning:'Organize simple tasks',
      claims:[{id:'claim1',text:'Includes task lists',evidenceId:'source1'}]},
    evidence:[{id:'source1',url:'https://example.org/docs/tasks',kind:'first-party-page'}],
    audience:{persona:'busy founders',pains:[{id:'pain1',summary:'Too many recurring tasks'}]},
    platforms:['youtube','instagram','tiktok','facebook'],
    pattern:'question',window:{startDate:'2026-10-21',postCount:3,intervalDays:2}
  };
}
function fails(input,code) {
  assert.throws(()=>proposeCampaign(input),e=>e.code===code);
}
test('same input gives byte-identical deterministic campaign and receipt',()=>{
  const x=fixture();
  assert.deepEqual(proposeCampaign(x),proposeCampaign(JSON.parse(JSON.stringify(x))));
});
test('isolated workspace creates distinct IDs and stable provenance receipt',()=>{
  const a=fixture(),b=fixture();b.workspaceId='workspace-b';
  assert.notEqual(proposeCampaign(a).receipt.campaignId,proposeCampaign(b).receipt.campaignId);
  assert.deepEqual(proposeCampaign(a).receipt.sourceEvidenceIds,['source1']);
});
test('dates, platforms and slideshow structure are deterministic proposals only',()=>{
  const c=proposeCampaign(fixture());
  assert.deepEqual(c.posts.map(x=>x.proposedDay),['2026-10-21','2026-10-23','2026-10-25']);
  assert.equal(c.posts[0].storyboard.slides.length,5);
  assert.equal(c.posts[0].storyboard.width,1080);
  assert.equal(c.posts[0].storyboard.height,1920);
  assert.deepEqual(c.posts[0].platforms,['facebook','instagram','tiktok','youtube']);
  assert.equal(c.receipt.providerOperations,0);
  assert.equal(c.canSchedule,false);
  assert.equal(c.canPublish,false);
  assert.equal(c.posts.every(x=>x.approvalRequired),true);
});
test('unsupported product claims cannot enter a storyboard',()=>{
  const x=fixture();x.product.claims[0].evidenceId='missing';
  fails(x,'UNSUPPORTED_CLAIM');
});
test('private, unencrypted or credential-bearing targets rejected before any fetch',()=>{
  for(const url of ['http://example.org','https://localhost/private','https://192.168.1.8/path',
    'https://account:pass@example.org/a','https://example.org:8443/a']) {
    const x=fixture();x.product.url=url;fails(x,'INVALID_PUBLIC_URL');
  }
});
test('unlicensed/free-form external template input is rejected',()=>{
  const x=fixture();x.pattern='copy this creator slide';
  fails(x,'INVALID_PATTERN');
});
test('duplicate evidence IDs are blocked and cannot substitute provenance',()=>{
  const x=fixture();x.evidence.push({...x.evidence[0]});
  fails(x,'DUPLICATE_ID');
});
test('invalid campaign cardinality and channel list fail closed',()=>{
  const x=fixture();x.window.postCount=100;fails(x,'INVALID_LIMIT');
  x.window.postCount=1;x.platforms=['unknown'];fails(x,'INVALID_PLATFORM');
});
test('impossible calendar dates fail rather than rolling into another month',()=>{
  const x=fixture();x.window.startDate='2026-02-30';
  fails(x,'INVALID_START_DATE');
});
test('no unverified claim fallback and no network/API-key/publishing side effects',()=>{
  const x=fixture();x.evidence=[];
  fails(x,'UNSUPPORTED_CLAIM');
  const p=proposeCampaign(fixture());
  assert.equal(p.posts[0].storyboard.slides[2].assertion,'owner-provided-claim');
  assert.deepEqual(p.posts[0].storyboard.slides[2].evidenceIds,['source1']);
  assert.equal(p.receipt.publishAuthority,'NONE');
});
