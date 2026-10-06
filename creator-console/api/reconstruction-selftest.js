'use strict';
const {runReconstruction}=require('../lib/reconstruction');

const factual={id:'doc',sourceClass:'official-doc',resolved:true,content:'Official technical documentation with enough source content to understand the claim.'};
const style={id:'style',sourceClass:'structural-reference',resolved:true,content:'A creator post used only for structural inspiration.'};
const mcp={id:'mcp',sourceClass:'official-source',resolved:true,content:'Reference MCP servers for learning and SDK examples.',semanticLimitations:['reference-implementation-not-production-ready']};

function projectInput(){return{
  topic:'Data Engineering + GenAI project path with RAG and MCP',
  sources:[factual,mcp],
  claims:[{id:'claim',text:'A staged project can connect data engineering, RAG and MCP.',evidenceSourceIds:['doc']}],
  requiresJudgment:true,
  authorAssertions:[{id:'author',text:'Emphasize production trade-offs and recovery, not course completion.',owner:'creator'}],
  clusters:[
    {id:'data',title:'Data ingestion and SQL'},
    {id:'pipeline',title:'Python pipeline and orchestration',prerequisiteIds:['data']},
    {id:'rag',title:'RAG with citations and evaluation',prerequisiteIds:['pipeline']},
    {id:'mcp-step',title:'MCP interface and production boundaries',prerequisiteIds:['rag']}
  ],
  projectSpine:{title:'Cited documentation assistant',cumulativeArtifact:'Ingestion + index + cited RAG + MCP interface + evaluation plan'}
}}

module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  const styleFail=runReconstruction({topic:'claim',sources:[style],claims:[{id:'x',text:'A factual claim',evidenceSourceIds:['style']}]});
  const authorshipInput=projectInput();authorshipInput.authorAssertions=[];
  const authorFail=runReconstruction(authorshipInput);
  const good=runReconstruction(projectInput());
  const unresolved=runReconstruction({topic:'community',sources:[{id:'short',sourceClass:'community-feedback',resolved:false}],claims:[{id:'u',text:'Community claim',evidenceSourceIds:['short']}]});
  const checks={
    styleOnlyFailsEvidence:styleFail.status==='BLOCKED_EVIDENCE_INSUFFICIENT',
    missingJudgmentFailsClosed:authorFail.status==='BLOCKED_AUTHORSHIP_INSUFFICIENT',
    projectSeriesReady:good.status==='CONTENT_PLAN_READY'&&good.contentPlan.type==='project-backed-series',
    seriesIsAcyclic:good.contentPlan.acyclic===true&&good.contentPlan.lessonOrder.join(',')==='data,pipeline,rag,mcp-step',
    referenceWarningPreserved:good.contentPlan.productionWarnings.some(x=>x.sourceId==='mcp'&&x.limitation==='reference-implementation-not-production-ready'),
    artifactsRequested:good.contentPlan.artifactRequirements.includes('architecture-or-data-flow-diagram')&&good.contentPlan.artifactRequirements.includes('code-or-implementation-example'),
    unresolvedDoesNotBecomeEvidence:unresolved.status==='BLOCKED_EVIDENCE_INSUFFICIENT'&&unresolved.understanding.unresolvedSourceIds.includes('short')
  };
  return res.status(200).json({ok:Object.values(checks).every(Boolean),schema:'creator-reconstruction-selftest/v1',checks,example:{status:good.status,states:good.states,contentPlan:good.contentPlan,receipt:good.receipt}});
};
