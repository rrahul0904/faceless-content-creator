'use strict';
const {discover}=require('../lib/research-agent');
const store=require('../lib/store');
module.exports=async function(req,res){
  if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.authorization!==`Bearer ${secret}`)return res.status(401).json({error:'UNAUTHORIZED'});
  try{
    const result=await discover({limit:50,enrichLimit:16});let persisted=0,persistence='not-configured';
    if(store.config().configured){const saved=await store.saveResearch(result.items);persisted=Array.isArray(saved)?saved.length:0;persistence='durable';}
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,schema:'creator-research-refresh/v1',generatedAt:result.generatedAt,liveDiscoveryCount:result.liveDiscoveryCount,enrichedCount:result.enrichedCount,sourceStatus:result.sources,persistence,persisted});
  }catch(e){return res.status(500).json({ok:false,error:e.code||'RESEARCH_REFRESH_FAILED',message:String(e.message||e)});}
};
