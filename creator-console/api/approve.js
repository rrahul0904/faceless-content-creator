'use strict';
const {sign}=require('../lib/approval');
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}), receipt=body.runReceipt||{};
    if(receipt.schema!=='creator-run-receipt/v1'||receipt.status!=='approval-required')return res.status(409).json({error:'RUN_NOT_APPROVABLE',message:'Only quality-passed runs waiting for approval can be approved.'});
    const drafts=body.drafts&&typeof body.drafts==='object'?body.drafts:{};
    const approvals={};
    for(const p of receipt.platforms||[]){const draft=String(drafts[p]||'').trim();if(!draft)return res.status(400).json({error:'DRAFT_REQUIRED',message:`Missing ${p} draft.`});approvals[p]=sign({runId:receipt.runId,platform:p,draft});}
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,schema:'creator-approval-bundle/v1',runId:receipt.runId,approvals});
  }catch(e){return res.status(400).json({error:e.code||'APPROVAL_FAILED',message:String(e.message||e)});}
};
