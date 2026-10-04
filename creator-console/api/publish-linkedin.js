'use strict';
const {verify}=require('../lib/approval');
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),draft=String(body.draft||'').trim(),approval=body.approval;
    if(!draft)return res.status(400).json({error:'DRAFT_REQUIRED'});
    const gate=verify(approval,{draft,platform:'linkedin'});
    if(!gate.passed)return res.status(409).json({error:'APPROVAL_REQUIRED',issues:gate.errors});
    const token=process.env.LINKEDIN_ACCESS_TOKEN,author=process.env.LINKEDIN_AUTHOR_URN,version=process.env.LINKEDIN_VERSION||'202609';
    if(!token||!author)return res.status(503).json({error:'LINKEDIN_NOT_CONNECTED',message:'Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN after authorizing w_member_social.'});
    const payload={author,commentary:draft,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false};
    const r=await fetch('https://api.linkedin.com/rest/posts',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Linkedin-Version':version,'X-Restli-Protocol-Version':'2.0.0'},body:JSON.stringify(payload)});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={raw:text.slice(0,1000)}}
    if(!r.ok)return res.status(r.status).json({error:'LINKEDIN_PUBLISH_FAILED',status:r.status,details:data});
    const postId=r.headers.get('x-restli-id')||data?.id||null;
    res.setHeader('Cache-Control','no-store');
    return res.status(201).json({ok:true,schema:'creator-publication-receipt/v1',platform:'linkedin',runId:approval.runId,postId,publishedAt:new Date().toISOString(),draftHash:approval.draftHash,linkedinVersion:version});
  }catch(e){return res.status(500).json({error:e.code||'LINKEDIN_PUBLISH_FAILED',message:String(e.message||e)});}
};
