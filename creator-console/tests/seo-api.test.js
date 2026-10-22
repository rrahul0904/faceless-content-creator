'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/seo-article');
const key='test-only-operator-key-with-32-characters';
const secret='test-only-approval-signing-secret';
const original={key:process.env.CREATOR_SEO_API_KEY,approval:process.env.CREATOR_APPROVAL_SECRET};
test.after(()=>{
  if(original.key===undefined) delete process.env.CREATOR_SEO_API_KEY; else process.env.CREATOR_SEO_API_KEY=original.key;
  if(original.approval===undefined) delete process.env.CREATOR_APPROVAL_SECRET; else process.env.CREATOR_APPROVAL_SECRET=original.approval;
});
function articleInput(){
  return {workspaceId:'owner-one',topic:'Data ingestion',keyword:'reliable ingestion',audience:'data engineers',
    sources:[
      {id:'one',title:'Technical source',url:'https://docs.example.org/ingest',excerpt:'First source excerpt.'},
      {id:'two',title:'Research source',url:'https://research.example.org/storage',excerpt:'Independent evidence excerpt.'}
    ],
    outline:{title:'Reliable Ingestion',sections:[
      {id:'capture',heading:'Capture',sourceIds:['one']},
      {id:'recover',heading:'Recover',sourceIds:['two']}
    ]}
  };
}
function response(){
  return {statusCode:200,payload:null,setHeader(){},status(n){this.statusCode=n;return this},json(data){this.payload=data;return this}};
}
async function call(body,header=key,method='POST'){
  const res=response();
  await handler({method,headers:{'x-creator-seo-key':header},body},res);
  return res;
}
function section(link){
  return 'Design clear article sections that each have specific evidence and review notes. '+
    'Verify statements before trusting a piece of generated content. '+
    'Use retries and stable IDs in systems that handle multiple concurrent requests. '+
    'Do not claim external model execution when none happened. [Source]('+link+')';
}
test('public and unconfigured access both fail closed',async()=>{
  delete process.env.CREATOR_SEO_API_KEY;
  const noConfig=await call({input:articleInput()});
  assert.equal(noConfig.statusCode,503);
  process.env.CREATOR_SEO_API_KEY=key;
  const unauthorized=await call({input:articleInput()},'not-the-key');
  assert.equal(unauthorized.statusCode,401);
  assert.equal((await call({},key,'GET')).statusCode,405);
});
test('operator review gate is explicit and signed; result still draft-only',async()=>{
  process.env.CREATOR_SEO_API_KEY=key;
  process.env.CREATOR_APPROVAL_SECRET=secret;
  const input=articleInput();
  const preview=await call({op:'preview',input});
  assert.equal(preview.statusCode,200);
  assert.equal(preview.payload.status,'outline-approval-required');
  const noReview=await call({op:'approve-outline',input});
  assert.equal(noReview.statusCode,409);
  const approved=await call({op:'approve-outline',reviewAcknowledged:true,input});
  assert.equal(approved.statusCode,200);
  assert.equal(approved.payload.outlineApproval.schema,'creator-approval-receipt/v1');
  const result=await call({op:'preview',input:{...input,outlineApproval:approved.payload.outlineApproval,
    sectionDrafts:{capture:section(input.sources[0].url),recover:section(input.sources[1].url)}}});
  assert.equal(result.statusCode,200);
  assert.equal(result.payload.status,'editorial-review-required');
  assert.equal(result.payload.publish,false);
  assert.equal(result.payload.receipt.externalWrites,0);
});
