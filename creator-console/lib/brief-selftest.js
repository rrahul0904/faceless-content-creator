'use strict';
const {buildBriefBundle}=require('./content-brief');

function runBriefSelftest(){
  const fixed='2026-10-06T19:35:00.000Z';
  const officialInput={brief:{topic:'Official source path',createdAt:fixed},sources:[{id:'official',url:'https://docs.example.com/release',evidenceClass:'official-doc',resolutionStatus:'resolved',capturedAt:fixed}],claims:[{text:'The feature is generally available.',claimType:'fact',supportingSourceIds:['official']}],evaluatedAt:fixed};
  const official=buildBriefBundle(officialInput);
  const officialReplay=buildBriefBundle(officialInput);
  const reference=buildBriefBundle({brief:{topic:'Reference-only path',createdAt:fixed},sources:[{id:'reference',url:'https://www.linkedin.com/posts/example',evidenceClass:'reference-pattern',resolutionStatus:'resolved',capturedAt:fixed}],claims:[{text:'Latency improved by 40%.',claimType:'fact',supportingSourceIds:['reference']}],evaluatedAt:fixed});
  const unresolved=buildBriefBundle({brief:{topic:'Unresolved community path',createdAt:fixed},sources:[{id:'community',url:'https://www.reddit.com/r/example/s/abc',evidenceClass:'community',resolutionStatus:'unresolved-shortlink',capturedAt:fixed}],claims:[{text:'Users prefer this workflow.',claimType:'fact',supportingSourceIds:['community']}],evaluatedAt:fixed});
  const experience=buildBriefBundle({brief:{topic:'Experience path',mode:'experience',createdAt:fixed},sources:[{id:'reference',url:'https://www.linkedin.com/posts/example',evidenceClass:'reference-pattern',resolutionStatus:'resolved',capturedAt:fixed}],claims:[{text:'I deployed this in production.',claimType:'author-experience',supportingSourceIds:['reference']}],evaluatedAt:fixed});
  const opinion=buildBriefBundle({brief:{topic:'Opinion path',createdAt:fixed},sources:[],claims:[{text:'I prefer explicit evidence gates.',claimType:'creator-opinion',supportingSourceIds:[]}],evaluatedAt:fixed});
  const checks={
    officialFactBecomesEvidenceReady:official.gate.passed&&official.brief.status==='evidence-ready',
    referencePatternCannotSupportFact:!reference.gate.passed&&reference.brief.status==='blocked-evidence'&&reference.claims[0]?.status==='unsupported',
    unresolvedCommunityCannotSupportFact:!unresolved.gate.passed&&unresolved.brief.status==='blocked-evidence'&&unresolved.claims[0]?.status==='unsupported',
    experienceRequiresAuthorOwnedEvidence:!experience.gate.passed&&experience.brief.status==='blocked-evidence'&&experience.claims[0]?.status==='unsupported',
    creatorOpinionCanStandAlone:opinion.gate.passed&&opinion.brief.status==='evidence-ready'&&opinion.claims[0]?.status==='supported',
    receiptReplayDeterministic:official.receiptHash===officialReplay.receiptHash&&/^[a-f0-9]{64}$/.test(official.receiptHash)
  };
  return{ok:Object.values(checks).every(Boolean),schema:'creator-brief-selftest/v1',checks,examples:{official:{status:official.brief.status,receiptHash:official.receiptHash},reference:{status:reference.brief.status},unresolved:{status:unresolved.brief.status},experience:{status:experience.brief.status},opinion:{status:opinion.brief.status}}};
}
module.exports={runBriefSelftest};
