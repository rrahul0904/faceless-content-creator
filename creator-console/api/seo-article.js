'use strict';
// Intentionally isolated from social publication endpoints.
const crypto = require('node:crypto');
const {run} = require('../lib/seo-article');
const {sign} = require('../lib/approval');
function authorized(req) {
  const expected = process.env.CREATOR_SEO_API_KEY;
  if (!expected || expected.length < 24) return false;
  const actual = String(req.headers?.['x-creator-seo-key'] || '');
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
module.exports = async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!process.env.CREATOR_SEO_API_KEY || process.env.CREATOR_SEO_API_KEY.length < 24) {
    return res.status(503).json({error:'SEO_OPERATOR_AUTH_NOT_CONFIGURED'});
  }
  if(!authorized(req)) return res.status(401).json({error:'UNAUTHORIZED'});
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    if(JSON.stringify(body).length>300000) return res.status(413).json({error:'PAYLOAD_TOO_LARGE'});
    const input=body.input||body;
    const op=String(body.op||'preview');
    if(op==='preview') return res.status(200).json(await run(input,{approvalSecret:process.env.CREATOR_APPROVAL_SECRET}));
    if(op==='approve-outline') {
      if(!process.env.CREATOR_APPROVAL_SECRET) return res.status(503).json({error:'APPROVAL_SIGNER_NOT_CONFIGURED'});
      if(body.reviewAcknowledged!==true) return res.status(409).json({error:'EXPLICIT_OUTLINE_REVIEW_REQUIRED'});
      const preview=await run({...input,outlineApproval:null},{approvalSecret:process.env.CREATOR_APPROVAL_SECRET});
      return res.status(200).json({schema:'seo-outline-approval-response/v1',runId:preview.runId,
        outlineApproval:sign({runId:preview.runId,platform:'seo-outline',draft:preview.outlineReviewText},process.env.CREATOR_APPROVAL_SECRET)});
    }
    return res.status(404).json({error:'UNKNOWN_OPERATION'});
  } catch(e) {
    return res.status(e.status||400).json({error:e.code||'SEO_ARTICLE_FAILED',message:String(e.message||e)});
  }
};
