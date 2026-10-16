'use strict';

function renderPlane(){return String(process.env.VISUAL_RENDER_BASE_URL||'').replace(/\/$/,'');}
function headers(){const key=String(process.env.VISUAL_RENDER_API_KEY||'').trim();return {'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})};}
function safeId(value){return /^[a-zA-Z0-9_-]{6,128}$/.test(String(value||''));}
async function relay(response,res){const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{data={error:'RENDER_PLANE_INVALID_RESPONSE'};}return res.status(response.status).json(data);}

module.exports=async function(req,res){
  const base=renderPlane();
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED'});
  try{
    const storyId=Array.isArray(req.query?.storyId)?req.query.storyId[0]:req.query?.storyId;
    const versionRaw=Array.isArray(req.query?.version)?req.query.version[0]:req.query?.version;
    const action=Array.isArray(req.query?.action)?req.query.action[0]:req.query?.action;
    if(storyId&&!safeId(storyId))return res.status(400).json({error:'INVALID_STORY_ID'});
    if(versionRaw&&(!/^\d+$/.test(String(versionRaw))||Number(versionRaw)<1))return res.status(400).json({error:'INVALID_VERSION'});

    if(req.method==='GET'){
      const path=!storyId?'/api/v1/visual-stories':versionRaw?`/api/v1/visual-stories/${encodeURIComponent(storyId)}/versions/${encodeURIComponent(versionRaw)}`:`/api/v1/visual-stories/${encodeURIComponent(storyId)}`;
      return relay(await fetch(base+path,{headers:headers()}),res);
    }

    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    if(req.method==='POST'&&!storyId){
      return relay(await fetch(`${base}/api/v1/visual-stories`,{method:'POST',headers:headers(),body:JSON.stringify(body)}),res);
    }
    if(req.method==='PUT'&&storyId){
      return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}`,{method:'PUT',headers:headers(),body:JSON.stringify(body)}),res);
    }
    if(req.method==='POST'&&storyId&&action==='refine'){
      return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}/refine`,{method:'POST',headers:headers(),body:JSON.stringify(body)}),res);
    }
    if(req.method==='POST'&&storyId&&versionRaw){
      return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}/versions/${encodeURIComponent(versionRaw)}`,{method:'POST',headers:headers(),body:'{}'}),res);
    }
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }catch(error){
    return res.status(502).json({error:'RENDER_PLANE_UNAVAILABLE',message:error instanceof Error?error.message:String(error)});
  }
};
