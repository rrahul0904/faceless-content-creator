'use strict';
const crypto=require('crypto');
function draftHash(text){return crypto.createHash('sha256').update(String(text||'')).digest('hex')}
function canonical(r){return [r.schema,r.runId,r.platform,r.draftHash,r.approvedAt,r.expiresAt].join('|')}
function sign({runId,platform,draft,ttlSeconds=7200},secret=process.env.CREATOR_APPROVAL_SECRET){
  if(!secret)throw Object.assign(new Error('Approval signer is not configured'),{code:'APPROVAL_SIGNER_NOT_CONFIGURED'});
  const approvedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+Math.max(300,Math.min(86400,ttlSeconds))*1000).toISOString();
  const receipt={schema:'creator-approval-receipt/v1',runId:String(runId||''),platform:String(platform||''),draftHash:draftHash(draft),approvedAt,expiresAt};
  receipt.signature=crypto.createHmac('sha256',secret).update(canonical(receipt)).digest('hex');
  return receipt;
}
function verify(receipt,{draft,platform},secret=process.env.CREATOR_APPROVAL_SECRET){
  const errors=[];
  if(!secret)errors.push('APPROVAL_SIGNER_NOT_CONFIGURED');
  if(!receipt||receipt.schema!=='creator-approval-receipt/v1')errors.push('INVALID_APPROVAL_SCHEMA');
  if(receipt&&String(receipt.platform)!==String(platform))errors.push('APPROVAL_PLATFORM_MISMATCH');
  if(receipt&&receipt.draftHash!==draftHash(draft))errors.push('APPROVED_CONTENT_CHANGED');
  if(receipt&&Date.parse(receipt.expiresAt)<=Date.now())errors.push('APPROVAL_EXPIRED');
  if(receipt&&secret){const expected=crypto.createHmac('sha256',secret).update(canonical(receipt)).digest('hex');const a=Buffer.from(String(receipt.signature||'')),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))errors.push('INVALID_APPROVAL_SIGNATURE');}
  return{passed:errors.length===0,errors};
}
module.exports={draftHash,sign,verify};
