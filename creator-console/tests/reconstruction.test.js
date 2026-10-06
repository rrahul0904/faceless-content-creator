'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runReconstruction,sourceCanSupportFact,chooseContentPlan}=require('../lib/reconstruction');

const official={
  id:'official-mcp',
  url:'https://github.com/modelcontextprotocol/servers',
  title:'MCP reference servers',
  sourceClass:'official-source',
  publisher:'Model Context Protocol',
  content:'Reference implementations intended to demonstrate MCP features and SDK usage.',
  observations:['Maintained servers are reference implementations.'],
  semanticLimitations:['reference-implementation-not-production-ready']
};
const gaurav={
  id:'gaurav-learning-path',
  url:'https://www.linkedin.com/posts/gaurav--sinha_if-youre-preparing-for-data-engineering-share-7512081251940429824-Qrvc/',
  title:'Data Engineering and GenAI Project-Based Learning Path',
  sourceClass:'first-party-public',
  publisher:'Gaurav Sinha',
  content:'Follow a sequence and build one end-to-end project alongside it: SQL, Python, data engineering fundamentals, Spark/Airflow/dbt/Kafka, GenAI, RAG and MCP.',
  observations:['Recommends a sequenced curriculum and one cumulative portfolio project.']
};

function baseInput(){return{
  topic:'Data Engineering + GenAI project-based learning path',
  sources:[gaurav,official],
  claims:[{id:'c1',text:'The source recommends a sequenced learning path anchored by one end-to-end project.',evidenceSourceIds:['gaurav-learning-path']}],
  authorAssertions:[{id:'a1',text:'I want the series to emphasize production trade-offs instead of course completion.',kind:'judgment',owner:'creator'}],
  requiresJudgment:true,
  clusters:[
    {id:'sql',title:'SQL and incremental processing'},
    {id:'python',title:'Python for data workloads',prerequisiteIds:['sql']},
    {id:'de',title:'Data engineering systems',prerequisiteIds:['python'],milestone:'Reliable ingestion pipeline'},
    {id:'genai',title:'GenAI and evaluation',prerequisiteIds:['de']},
    {id:'rag',title:'RAG with citations',prerequisiteIds:['genai'],milestone:'Cited retrieval assistant'},
    {id:'mcp',title:'MCP interface and production boundaries',prerequisiteIds:['rag'],milestone:'Reference MCP interface with production caveats'}
  ],
  projectSpine:{title:'Cited technical documentation assistant',cumulativeArtifact:'Ingestion + index + cited RAG + MCP interface + evaluation/monitoring plan'}
}}

test('style-only reference cannot satisfy factual evidence',()=>{
  assert.equal(sourceCanSupportFact({sourceClass:'structural-reference',resolved:true,metadataOnly:false}),false);
  const r=runReconstruction({
    topic:'LLM gateway latency',
    sources:[{id:'style',sourceClass:'structural-reference',resolved:true,content:'A creator post with a strong hook.'}],
    claims:[{id:'claim',text:'Gateway overhead is 0.66 ms.',benchmark:true,benchmarkConditions:'Unspecified external benchmark',evidenceSourceIds:['style']}]
  });
  assert.equal(r.status,'BLOCKED_EVIDENCE_INSUFFICIENT');
  assert.ok(r.evidence.claims[0].issues.includes('FACTUAL_CLAIM_WITHOUT_QUALIFYING_EVIDENCE'));
});

test('benchmark requires conditions even with factual source',()=>{
  const r=runReconstruction({
    topic:'Latency benchmark',
    sources:[{id:'official',sourceClass:'official-source',resolved:true,content:'Official benchmark result.'}],
    claims:[{id:'bench',text:'Latency is 1 ms.',benchmark:true,evidenceSourceIds:['official']}]
  });
  assert.equal(r.status,'BLOCKED_EVIDENCE_INSUFFICIENT');
  assert.ok(r.evidence.claims[0].issues.includes('BENCHMARK_CONDITIONS_REQUIRED'));
});

test('missing creator judgment fails closed for opinionated plan',()=>{
  const input=baseInput();
  input.authorAssertions=[];
  const r=runReconstruction(input);
  assert.equal(r.status,'BLOCKED_AUTHORSHIP_INSUFFICIENT');
  assert.equal(r.authorship.blockedReason,'BLOCKED_AUTHORSHIP_INSUFFICIENT');
  assert.ok(r.authorship.questions.length>=2);
});

test('Gaurav path produces dependency-safe project-backed series',()=>{
  const r=runReconstruction(baseInput());
  assert.equal(r.status,'CONTENT_PLAN_READY');
  assert.deepEqual(r.states,['CAPTURED','UNDERSTANDING','EVIDENCE_READY','AUTHORSHIP_READY','CONTENT_PLAN']);
  assert.equal(r.contentPlan.type,'project-backed-series');
  assert.equal(r.contentPlan.acyclic,true);
  assert.deepEqual(r.contentPlan.lessonOrder,['sql','python','de','genai','rag','mcp']);
  assert.equal(r.contentPlan.projectSpine.cumulativeArtifact.includes('cited RAG'),true);
  assert.ok(r.contentPlan.artifactRequirements.includes('architecture-or-data-flow-diagram'));
  assert.ok(r.contentPlan.artifactRequirements.includes('code-or-implementation-example'));
});

test('reference/tutorial semantic warning survives into content plan',()=>{
  const r=runReconstruction(baseInput());
  assert.ok(r.contentPlan.productionWarnings.some(x=>x.sourceId==='official-mcp'&&x.limitation==='reference-implementation-not-production-ready'));
});

test('unresolved sources stay unresolved and do not qualify as evidence',()=>{
  const r=runReconstruction({
    topic:'Snowflake community claim',
    sources:[{id:'reddit-short',sourceClass:'community-feedback',resolved:false,url:'https://www.reddit.com/r/snowflake/s/example'}],
    claims:[{id:'c',text:'Community agrees with the claim.',evidenceSourceIds:['reddit-short']}]
  });
  assert.equal(r.status,'BLOCKED_EVIDENCE_INSUFFICIENT');
  assert.deepEqual(r.understanding.unresolvedSourceIds,['reddit-short']);
  assert.match(r.understanding.warnings[0],/no title, sentiment, workflow or technical conclusion/i);
});

test('broad multi-cluster topic evaluates to series when no project spine exists',()=>{
  const p=chooseContentPlan({topic:'RAG architecture',clusters:['retrieval','reranking','generation','evaluation']});
  assert.equal(p.type,'series');
  assert.equal(p.acyclic,true);
  assert.equal(p.lessons.length,4);
});
