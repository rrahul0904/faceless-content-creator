'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {run, normalize, checkSection} = require('../lib/seo-article');
const {sign} = require('../lib/approval');
const secret = 'test-only-seo-approval-secret';
const sources = [
  {id:'official',title:'Architecture design notes',url:'https://docs.example.org/architecture',excerpt:'An independently reviewable architecture reference.'},
  {id:'paper',title:'Independent systems paper',url:'https://research.example.org/papers/design',excerpt:'A second external technical perspective.'}
];
function fixture() {
  return {workspaceId:'test-team',topic:'Reliable data workflows',keyword:'workflow reliability',
    audience:'data engineers',voice:'precise technical writing',sources,
    outline:{title:'Reliable Data Workflows',metaDescription:'Ways to build reliable data workflows.',
      sections:[{id:'design',heading:'Design principles',sourceIds:['official']},
        {id:'testing',heading:'Testing and recovery',sourceIds:['paper']}]}};
}
function paragraph(link) {
  return 'Reliable systems need explicit inputs, observable state transitions, and repeatable checks before a task advances. ' +
    'Each article section should connect a narrowly scoped claim to a reviewable source. ' +
    'A human editor checks accuracy and context before sharing anything with readers. ' +
    '[Reference](' + link + ') provides supporting context for further validation.';
}
async function approved(f = fixture()) {
  const pending = await run(f, {approvalSecret:secret});
  assert.equal(pending.status, 'outline-approval-required');
  const outlineApproval = sign({runId:pending.runId,platform:'seo-outline',draft:pending.outlineReviewText},secret);
  return {...f,outlineApproval};
}
test('fails closed until outline receipt is signed',async()=>{
  const result = await run(fixture(),{approvalSecret:secret});
  assert.equal(result.status,'outline-approval-required');
  assert.equal(result.publish,false);
  assert.equal(result.receipt.externalWrites,0);
  assert.equal(result.sources[0].verified,false);
});
test('missing model adapter does not pretend to write an article',async()=>{
  const result = await run(await approved(),{approvalSecret:secret});
  assert.equal(result.status,'model-not-configured');
  assert.equal(result.article,undefined);
});
test('assembles source-cited sections and requires editorial review',async()=>{
  const data = await approved();
  data.sectionDrafts = {design:paragraph(sources[0].url),testing:paragraph(sources[1].url)};
  const result = await run(data,{approvalSecret:secret});
  assert.equal(result.status,'editorial-review-required');
  assert.match(result.article,/^# Reliable Data Workflows/);
  assert.equal(result.checks.length,2);
  assert.ok(result.checks.every(x=>x.passed));
  assert.equal(result.receipt.externalWrites,0);
  assert.equal(result.receipt.sourcesVerified,false);
  assert.equal(result.publish,false);
});
test('a model adapter sees only evidence assigned to its section',async()=>{
  const data = await approved();
  const seen = [];
  const result = await run(data,{approvalSecret:secret,async writeSection(arg) {
    seen.push(arg.evidence.map(s=>s.id));
    return paragraph(arg.evidence[0].url);
  }});
  assert.equal(result.status,'editorial-review-required');
  assert.deepEqual(seen,[['official'],['paper']]);
});
test('tampering with approved outline blocks drafting',async()=>{
  const data = await approved();
  data.outline.sections[0].heading='Changed after signing';
  const result = await run(data,{approvalSecret:secret});
  assert.equal(result.status,'outline-approval-required');
  assert.ok(result.approvalErrors.includes('RUN_ID_MISMATCH'));
});
test('rejects unsupported citation even if another section cites correctly',async()=>{
  const data = await approved();
  data.sectionDrafts = {design:paragraph('https://other.example.com/claim'),testing:paragraph(sources[1].url)};
  const result = await run(data,{approvalSecret:secret});
  assert.equal(result.status,'quality-failed');
  assert.equal(result.article,null);
  assert.ok(result.checks[0].issues.includes('UNAPPROVED_CITATION'));
});
test('rejects uncited sections',()=>{
  const sec = fixture().outline.sections[0], map = new Map(sources.map(s=>[s.id,{...s,url:new URL(s.url).toString()}]));
  const r = checkSection(sec,paragraph('https://other.example.org/'),map);
  assert.equal(r.passed,false);
  assert.ok(r.issues.includes('SECTION_CITATION_MISSING'));
});
test('invalid, duplicate, and non-HTTPS sources fail at intake',()=>{
  const a=fixture();a.sources=[sources[0],sources[0]];
  assert.throws(()=>normalize(a),e=>e.code==='DUPLICATE_SOURCE');
  const b=fixture();b.sources[0]={...sources[0],url:'http://localhost/internal'};
  assert.throws(()=>normalize(b),e=>e.code==='INVALID_SOURCE_URL');
  const c=fixture();c.outline.sections[0].sourceIds=['fabricated'];
  assert.throws(()=>normalize(c),e=>e.code==='UNCITED_OUTLINE');
});
test('workspace scope changes the deterministic run identifier',()=>{
  const a=normalize(fixture()),b=normalize({...fixture(),workspaceId:'other-team'});
  assert.notEqual(a.runId,b.runId);
  assert.equal(a.runId,normalize(fixture()).runId);
});
test('unsubstantiated first-person experience requires review',()=>{
  const map = new Map(sources.map(s=>[s.id,{...s,url:new URL(s.url).toString()}]));
  const result=checkSection(fixture().outline.sections[0],paragraph(sources[0].url)+' I personally benchmarked it.',map);
  assert.equal(result.passed,false);
  assert.ok(result.issues.includes('FIRST_PERSON_CLAIM_REVIEW'));
});
