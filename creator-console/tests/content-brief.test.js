'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sourceRecord,claim,createBrief,transition,attachSource,attachClaim,evidenceGate,canDraft,deterministicSerialize,receiptHash}=require('../lib/content-brief');

function briefWithClaim({source,claimInput,mode='factual-explainer'}){
  let b=createBrief({topic:'Test topic',mode,createdAt:'2026-10-06T00:00:00.000Z'});
  b=attachSource(b,source);
  const c=claim({...claimInput,briefId:b.id,supportingSourceIds:[source.id]});
  b=attachClaim(b,c);
  return {b,c};
}

test('official source can support a factual claim but does not skip workflow states',()=>{
  const s=sourceRecord({url:'https://example.com/docs',evidenceClass:'official-doc',title:'Docs'});
  const {b,c}=briefWithClaim({source:s,claimInput:{text:'Feature is generally available',claimType:'fact'}});
  assert.equal(b.status,'captured');
  assert.equal(evidenceGate({brief:b,sources:[s],claims:[c]}).passed,true);
  assert.throws(()=>transition(b,'drafting'),/INVALID_TRANSITION/);
});

test('reference pattern never satisfies factual support',()=>{
  const s=sourceRecord({url:'https://linkedin.com/posts/example',evidenceClass:'reference-pattern',title:'Creator post'});
  const {b,c}=briefWithClaim({source:s,claimInput:{text:'Vendor reduced latency by 40%',claimType:'fact'}});
  const gate=evidenceGate({brief:b,sources:[s],claims:[c]});
  assert.equal(s.supportsFacts,false);
  assert.equal(gate.passed,false);
  assert.deepEqual(gate.unsupportedClaimIds,[c.id]);
});

test('unresolved shortlink is retained but cannot support facts',()=>{
  const s=sourceRecord({url:'https://www.reddit.com/r/example/s/abc',evidenceClass:'community',resolutionStatus:'unresolved-shortlink'});
  const {b,c}=briefWithClaim({source:s,claimInput:{text:'Users prefer workflow X',claimType:'fact'}});
  assert.equal(s.resolutionStatus,'unresolved-shortlink');
  assert.equal(canDraft({brief:b,sources:[s],claims:[c]}),false);
});

test('creator opinion can stand without external evidence',()=>{
  let b=createBrief({topic:'My architecture take',createdAt:'2026-10-06T00:00:00.000Z'});
  const c=claim({briefId:b.id,text:'I prefer explicit evidence gates for production content.',claimType:'creator-opinion'});
  b=attachClaim(b,c);
  const gate=evidenceGate({brief:b,sources:[],claims:[c]});
  assert.equal(gate.passed,true);
  assert.equal(gate.evaluatedClaims[0].status,'supported');
});

test('experience mode requires author-owned evidence',()=>{
  const ref=sourceRecord({url:'https://linkedin.com/posts/example',evidenceClass:'reference-pattern'});
  let b=createBrief({topic:'What I learned in production',mode:'experience',createdAt:'2026-10-06T00:00:00.000Z'});
  b=attachSource(b,ref);
  const c=claim({briefId:b.id,text:'I deployed this pattern in production.',claimType:'author-experience',supportingSourceIds:[ref.id]});
  b=attachClaim(b,c);
  assert.equal(evidenceGate({brief:b,sources:[ref],claims:[c]}).passed,false);
  const own=sourceRecord({url:'author://explicit-input/1',evidenceClass:'author-owned'});
  const c2=claim({briefId:b.id,text:'I deployed this pattern in production.',claimType:'author-experience',supportingSourceIds:[own.id]});
  b={...b,claimIds:[c2.id]};
  assert.equal(evidenceGate({brief:b,sources:[own],claims:[c2]}).passed,true);
});

test('state machine fails closed on impossible transitions',()=>{
  const b=createBrief({topic:'State machine',createdAt:'2026-10-06T00:00:00.000Z'});
  const researching=transition(b,'researching','2026-10-06T00:01:00.000Z');
  const ready=transition(researching,'evidence-ready','2026-10-06T00:02:00.000Z');
  assert.equal(ready.status,'evidence-ready');
  assert.throws(()=>transition(ready,'published'),/INVALID_TRANSITION/);
});

test('serialization and receipt hashing are deterministic',()=>{
  const a={z:2,a:{y:3,x:1},items:[{b:2,a:1}]};
  const b={items:[{a:1,b:2}],a:{x:1,y:3},z:2};
  assert.equal(deterministicSerialize(a),deterministicSerialize(b));
  assert.equal(receiptHash(a),receiptHash(b));
});
