'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeContract,evidenceGate,evaluateDraft,executeHarness}=require('../lib/harness');
const packet=(platform)=>({platform,selected:[{id:'ref1',type:'reference-pattern',text:'short structural reference only',trust:'style-only'}],retrieval:{selectedCount:1}});
const deps={buildContextPacket:({platform})=>packet(platform)};
const evidence=[
 {id:'s1',claim:'Official announcement',sourceUrl:'https://vendor.example/release',sourceType:'release-notes',publishedAt:new Date().toISOString()},
 {id:'s2',claim:'Official docs',sourceUrl:'https://vendor.example/docs',sourceType:'official-docs',publishedAt:new Date().toISOString()}
];
function draft(n,url='https://vendor.example/release'){return Array.from({length:n},(_,i)=>i===0?'Architecture':`word${i}`).join(' ')+`\n\nSource: ${url}`;}

test('contract locks 2-3 minute formats',()=>{const c=normalizeContract({topic:'RAG',platform:'both'});assert.deepEqual(c.platforms,['linkedin','medium']);assert.equal(c.readMinutes,'2-3');assert.equal(c.publish,false);});
test('evidence gate fails closed without primary source',()=>{const c=normalizeContract({topic:'RAG',minSources:1});const g=evidenceGate(c,[{sourceUrl:'https://x',sourceType:'practitioner'}]);assert.equal(g.passed,false);assert.ok(g.issues.some(x=>x.code==='PRIMARY_SOURCE_REQUIRED'));});
test('quality gate catches unsupported first-person and length',()=>{const c=normalizeContract({topic:'RAG'});const q=evaluateDraft('linkedin','I tested this and it works. Source: https://vendor.example/release',{contract:c,evidence,packet:packet('linkedin')});assert.equal(q.passed,false);assert.ok(q.issues.some(x=>x.code==='UNSUPPORTED_FIRST_PERSON'));assert.ok(q.issues.some(x=>x.code==='READ_LENGTH'));});
test('harness reaches approval only after evidence/context/quality gates',async()=>{const r=await executeHarness({topic:'RAG architecture',platform:'both',evidence,drafts:{linkedin:draft(320),medium:draft(620)}},{},deps);assert.equal(r.status,'approval-required');assert.equal(r.quality.linkedin.passed,true);assert.equal(r.quality.medium.passed,true);assert.equal(r.states.at(-1).state,'APPROVAL_REQUIRED');assert.equal(r.receipt.schema,'creator-run-receipt/v1');});
test('harness blocks when writer is absent instead of fabricating',async()=>{const r=await executeHarness({topic:'RAG architecture',platform:'linkedin',evidence},{},deps);assert.equal(r.status,'blocked-model');assert.equal(r.states.at(-1).state,'BLOCKED_MODEL_NOT_CONFIGURED');});
