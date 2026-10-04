'use strict';
const today=require('../data/today.json');
const research=require('../data/product-research.json');
const referenceInbox=require('../data/reference-inbox.json');
const {cleanTitle,meaningfulDescription,score,diversified}=require('../lib/research-agent');
const {buildContextPacket}=require('../lib/context');
const {sign,verify}=require('../lib/approval');
module.exports=async function(req,res){
  const technical=score({title:'New agent architecture for inference latency cost governance and observability',url:'https://example.com/agent'}),marketing=score({title:'Agentic marketing improves customer experience',url:'https://example.com/marketing'});
  const approvalSecret='creator-console-selftest-secret',approved='exact approved copy',receipt=sign({runId:'selftest',platform:'linkedin',draft:approved,ttlSeconds:600},approvalSecret);
  const vendorA=[...Array(8)].map((_,i)=>({vendor:'A',id:`a${i}`}));
  const vendorB=[...Array(3)].map((_,i)=>({vendor:'B',id:`b${i}`}));
  const diverse=diversified(vendorA.concat(vendorB),6);
  const context=buildContextPacket({topic:'Snowflake Cortex Agents production governance',platform:'linkedin',topK:12});
  const dash=context.selected.find(x=>x.id==='dash-cortex-agent-ga');
  const checks={
    feedHasPrimarySources:today.length>=4&&today.every(x=>/^https:\/\//.test(x.sourceUrl||'')&&/^2026-/.test(x.publishedAt||'')),
    feedHasTeachingAngles:today.every(x=>Array.isArray(x.angleSuggestions)&&x.angleSuggestions.length>=2),
    feedHasTransparentScores:today.every(x=>x.signals&&['fit','novelty','evidence','teachability'].every(k=>Number.isFinite(Number(x.signals[k])))),
    redditResearchRecorded:research.schema==='creator-product-research/v1'&&research.principles.length>=5,
    decisionsAreExplicit:research.principles.every(x=>x.insight&&x.productDecision&&Array.isArray(x.sources)&&x.sources.length>0),
    thinEvidenceRejected:!meaningfulDescription('With')&&!meaningfulDescription('Agents that interact'),
    vendorTitlesCleaned:cleanTitle('Platform & Products & Announcements September 30, 2026 Introducing ai_decide: make fast decisions on your governed data 5 min read')==='Introducing ai_decide: make fast decisions on your governed data',
    technicalRankingBeatsMarketing:technical.potential>marketing.potential,
    vendorDiversityEnforced:diverse.filter(x=>x.vendor==='B').length>=2,
    approvalContentBound:verify(receipt,{draft:approved,platform:'linkedin'},approvalSecret).passed&&!verify(receipt,{draft:'changed copy',platform:'linkedin'},approvalSecret).passed,
    submittedReferenceInboxLoaded:referenceInbox.length===6,
    submittedReferenceRetrievable:Boolean(dash),
    submittedReferencesStayStyleOnly:dash?.trust==='style-only',
    unresolvedRedditNotPromotedToEvidence:referenceInbox.filter(x=>x.platform==='reddit').every(x=>x.signals.includes('unresolved-shortlink'))
  };
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ok:Object.values(checks).every(Boolean),schema:'creator-product-selftest/v3',checks,seedFeedCount:today.length,researchPrinciples:research.principles.length,submittedReferences:referenceInbox.length});
};
