'use strict';

function renderPlane(){return String(process.env.VISUAL_RENDER_BASE_URL||'').replace(/\/$/,'');}
function headers(){const key=String(process.env.VISUAL_RENDER_API_KEY||'').trim();return {'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})};}
function safeJobId(value){return /^[a-zA-Z0-9_-]{6,128}$/.test(String(value||''));}
function absoluteResult(base,data){if(data?.data?.result?.url&&String(data.data.result.url).startsWith('/'))data.data.result.url=base+data.data.result.url;return data;}
async function relay(response,res,base){const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{data={error:'RENDER_PLANE_INVALID_RESPONSE'};}return res.status(response.status).json(absoluteResult(base,data));}

module.exports=async function(req,res){
  const base=renderPlane();
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED',fallback:'browser-animation'});
  try{
    if(req.method==='POST'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      if(!body.spec||!['gif','mp4'].includes(body.output||'gif'))return res.status(400).json({error:'INVALID_RENDER_REQUEST'});
      const response=await fetch(`${base}/api/v1/visual-stories/render`,{method:'POST',headers:headers(),body:JSON.stringify({spec:body.spec,output:body.output||'gif'})});
      return relay(response,res,base);
    }
    if(req.method==='GET'){
      const jobId=Array.isArray(req.query?.jobId)?req.query.jobId[0]:req.query?.jobId;
      if(!safeJobId(jobId))return res.status(400).json({error:'INVALID_JOB_ID'});
      const response=await fetch(`${base}/api/v1/render-jobs/${encodeURIComponent(jobId)}`,{headers:headers()});
      return relay(response,res,base);
    }
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }catch(error){
    return res.status(502).json({error:'RENDER_PLANE_UNAVAILABLE',message:error instanceof Error?error.message:String(error)});
  }
};
