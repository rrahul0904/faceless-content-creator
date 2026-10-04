'use strict';
const {discover}=require('../lib/research-agent');
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const limit=Math.max(1,Math.min(50,Number(req.query?.limit||20)));
    const result=await discover({limit});
    res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ok:true,...result});
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(500).json({ok:false,error:'DISCOVERY_FAILED',message:String(e.message||e)});
  }
};
