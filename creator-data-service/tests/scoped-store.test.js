'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createCreatorStore}=require('../scoped-store');

function bundle(briefId,title,claimText,startSeconds){
  return{
    brief:{id:briefId,topic:title,status:'evidence-ready',mode:'analysis',teachingOutcome:'Teach the distinction',creatorTake:'Keep identities brief-scoped.'},
    sources:[{id:'shared-source',url:`https://example.com/${briefId}`,canonicalUrl:`https://example.com/${briefId}`,evidenceClass:'official-doc',title:`Source ${title}`,publisher:'Example',resolutionStatus:'resolved',sourceLocator:{type:'timestamp',startSeconds,endSeconds:startSeconds+10}}],
    claims:[{id:'shared-claim',text:claimText,claimType:'fact',status:'supported',confidence:'high',supportingSourceIds:['shared-source']}]
  };
}

test('same logical source and claim ids remain isolated across briefs',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'creator-scoped-')),dbPath=path.join(dir,'creator.sqlite');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createCreatorStore({dbPath});
  store.saveBundle(bundle('brief-a','A','Claim A',10));
  store.saveBundle(bundle('brief-b','B','Claim B',90));
  const a=store.getBundle('brief-a'),b=store.getBundle('brief-b');
  assert.equal(a.sources[0].id,'shared-source');
  assert.equal(b.sources[0].id,'shared-source');
  assert.equal(a.sources[0].title,'Source A');
  assert.equal(b.sources[0].title,'Source B');
  assert.equal(a.sources[0].sourceLocator.startSeconds,10);
  assert.equal(b.sources[0].sourceLocator.startSeconds,90);
  assert.equal(a.claims[0].id,'shared-claim');
  assert.equal(b.claims[0].id,'shared-claim');
  assert.equal(a.claims[0].text,'Claim A');
  assert.equal(b.claims[0].text,'Claim B');
  assert.deepEqual(a.claims[0].supportingSourceIds,['shared-source']);
  assert.deepEqual(b.claims[0].supportingSourceIds,['shared-source']);
  assert.notEqual(store.latestReceipt('brief-a').hash,store.latestReceipt('brief-b').hash);
  store.close();
});
