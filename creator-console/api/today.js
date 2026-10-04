'use strict';
const {discover}=require('../lib/research-agent');
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const result=await discover({limit:20});
    const now=Date.now();
    const items=result.items.map(x=>({...x,ageDays:x.publishedAt?Math.max(0,Math.floor((now-Date.parse(`${x.publishedAt}T00:00:00Z`))/86400000)):null}));
    res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ok:true,schema:'creator-today-feed/v2',generatedAt:result.generatedAt,sourcePolicy:result.sourcePolicy,liveDiscoveryCount:result.liveDiscoveryCount,sources:result.sources,items});
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(500).json({ok:false,error:'TODAY_DISCOVERY_FAILED',message:String(e.message||e)});
  }
};
