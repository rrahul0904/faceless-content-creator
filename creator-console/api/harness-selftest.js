'use strict';
const {executeHarness}=require('../lib/harness');
function packet(platform){return{schema:'selftest-context/v1',platform,selected:[{id:'ref-selftest',type:'reference-pattern',text:'short structural reference only',trust:'style-only'}],retrieval:{selectedCount:1,candidateCount:1}};}
const deps={buildContextPacket:({platform})=>packet(platform)};
const evidence=[
 {id:'s1',claim:'Official announcement',sourceUrl:'https://vendor.example/release',sourceType:'release-notes',publishedAt:new Date().toISOString()},
 {id:'s2',claim:'Official docs',sourceUrl:'https://vendor.example/docs',sourceType:'official-docs',publishedAt:new Date().toISOString()}
];
function draft(n,url='https://vendor.example/release'){return Array.from({length:n},(_,i)=>i===0?'Architecture':`word${i}`).join(' ')+`\n\nSource: ${url}`;}
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const blockedEvidence=await executeHarness({topic:'RAG',platform:'linkedin',minSources:1,evidence:[{id:'x',claim:'Community post',sourceUrl:'https://community.example/post',sourceType:'practitioner'}]},{},deps);
    const blockedModel=await executeHarness({topic:'RAG',platform:'linkedin',evidence},{},deps);
    const approved=await executeHarness({topic:'RAG architecture',platform:'both',evidence,drafts:{linkedin:draft(320),medium:draft(620)}},{},deps);
    const checks={
      evidenceFailClosed:blockedEvidence.status==='blocked-evidence',
      modelFailClosed:blockedModel.status==='blocked-model',
      qualityToApproval:approved.status==='approval-required'&&approved.quality?.linkedin?.passed===true&&approved.quality?.medium?.passed===true,
      provenanceReceipt:approved.receipt?.schema==='creator-run-receipt/v1'&&Boolean(approved.receipt?.taskHash),
      publishRemainsOff:approved.contract?.publish===false
    };
    const passed=Object.values(checks).every(Boolean);
    res.setHeader('Cache-Control','no-store');
    return res.status(passed?200:500).json({ok:passed,schema:'creator-harness-selftest/v1',checks,terminalStates:{blockedEvidence:blockedEvidence.states.at(-1)?.state,blockedModel:blockedModel.states.at(-1)?.state,approved:approved.states.at(-1)?.state},quality:{linkedin:approved.quality?.linkedin,medium:approved.quality?.medium}});
  }catch(e){return res.status(500).json({ok:false,error:'SELFTEST_FAILED',message:e.message});}
};
