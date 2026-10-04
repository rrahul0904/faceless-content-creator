'use strict';
const store=require('../lib/store');
module.exports=async function(req,res){
  try{
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET')return res.status(200).json({ok:true,configured:store.config().configured,items:store.config().configured?await store.listDrafts(Number(req.query?.limit||50)):[]});
    if(req.method==='POST'){const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const saved=await store.saveDraft(body);return res.status(201).json({ok:true,items:saved});}
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }catch(e){const status=e.code==='STORAGE_NOT_CONFIGURED'?503:(e.status||400);return res.status(status).json({error:e.code||'DRAFT_STORE_FAILED',message:String(e.message||e),details:e.details||null});}
};
