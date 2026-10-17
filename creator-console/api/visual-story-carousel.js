'use strict';

function renderPlane(){return String(process.env.VISUAL_RENDER_BASE_URL||'').replace(/\/$/,'');}
function headers(){const key=String(process.env.VISUAL_RENDER_API_KEY||'').trim();return {'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})};}
function safeId(value){return /^[a-zA-Z0-9_-]{6,128}$/.test(String(value||''));}
async function relay(response,res){const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{data={error:'RENDER_PLANE_INVALID_RESPONSE'};}return res.status(response.status).json(data);}

module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const base=renderPlane();
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const storyId=body.storyId;
    if(storyId&&!safeId(storyId))return res.status(400).json({error:'INVALID_STORY_ID'});
    const itemsPerSlide=Math.max(1,Math.min(4,Number(body.itemsPerSlide||2)));
    const path=storyId?`/api/v1/visual-stories/${encodeURIComponent(storyId)}/carousel`:'/api/v1/visual-stories/carousel';
    const payload=storyId?{itemsPerSlide}:{spec:body.spec,itemsPerSlide};
    return relay(await fetch(base+path,{method:'POST',headers:headers(),body:JSON.stringify(payload)}),res);
  }catch(error){
    return res.status(502).json({error:'RENDER_PLANE_UNAVAILABLE',message:error instanceof Error?error.message:String(error)});
  }
};
