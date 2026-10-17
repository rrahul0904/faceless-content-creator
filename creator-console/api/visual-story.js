'use strict';
const { planVisualStory } = require('../lib/visual-story');
const { certifyVisualStory } = require('../lib/visual-story-qa');
const { registryVersion, verifiedAt, sources, searchTechnicalIcons } = require('../lib/technical-icons');

function renderPlane(){return String(process.env.VISUAL_RENDER_BASE_URL||'').replace(/\/$/,'');}
function renderHeaders(){const key=String(process.env.VISUAL_RENDER_API_KEY||'').trim();return {'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})};}
function first(value){return Array.isArray(value)?value[0]:value;}
function safeId(value){return /^[a-zA-Z0-9_-]{6,128}$/.test(String(value||''));}
function parseBody(req){return typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}
function absoluteResult(base,data){if(data?.data?.result?.url&&String(data.data.result.url).startsWith('/'))data.data.result.url=base+data.data.result.url;return data;}
async function relay(response,res,base='',absolute=false){const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{data={error:'RENDER_PLANE_INVALID_RESPONSE'};}return res.status(response.status).json(absolute?absoluteResult(base,data):data);}

async function planner(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{const story=planVisualStory(parseBody(req));const qa=certifyVisualStory(story);return res.status(200).json({story,qa});}
  catch(error){const status=Number(error&&error.status)||500;return res.status(status).json({error:error&&error.message||'VISUAL_STORY_FAILED'});}
}

async function icons(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const q=first(req.query?.q),provider=first(req.query?.provider);
  const data=searchTechnicalIcons(String(q||'').slice(0,160),String(provider||'').slice(0,40)).slice(0,100);
  return res.status(200).json({ok:true,registry:{version:registryVersion,verifiedAt,sources},data});
}

async function render(req,res,base){
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED',fallback:'browser-animation'});
  if(req.method==='POST'){
    const body=parseBody(req),output=body.output||'gif';
    if(!['gif','mp4'].includes(output))return res.status(400).json({error:'INVALID_RENDER_REQUEST'});
    if(body.storyId){
      if(!safeId(body.storyId))return res.status(400).json({error:'INVALID_STORY_ID'});
      return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(body.storyId)}/render`,{method:'POST',headers:renderHeaders(),body:JSON.stringify({output})}),res,base,true);
    }
    if(!body.spec)return res.status(400).json({error:'INVALID_RENDER_REQUEST'});
    return relay(await fetch(`${base}/api/v1/visual-stories/render`,{method:'POST',headers:renderHeaders(),body:JSON.stringify({spec:body.spec,output})}),res,base,true);
  }
  if(req.method==='GET'){
    const jobId=first(req.query?.jobId);if(!safeId(jobId))return res.status(400).json({error:'INVALID_JOB_ID'});
    return relay(await fetch(`${base}/api/v1/render-jobs/${encodeURIComponent(jobId)}`,{headers:renderHeaders()}),res,base,true);
  }
  return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
}

async function storage(req,res,base){
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED'});
  const storyId=first(req.query?.storyId),versionRaw=first(req.query?.version),action=first(req.query?.action);
  if(storyId&&!safeId(storyId))return res.status(400).json({error:'INVALID_STORY_ID'});
  if(versionRaw&&(!/^\d+$/.test(String(versionRaw))||Number(versionRaw)<1))return res.status(400).json({error:'INVALID_VERSION'});
  if(req.method==='GET'){
    const path=!storyId?'/api/v1/visual-stories':versionRaw?`/api/v1/visual-stories/${encodeURIComponent(storyId)}/versions/${encodeURIComponent(versionRaw)}`:`/api/v1/visual-stories/${encodeURIComponent(storyId)}`;
    return relay(await fetch(base+path,{headers:renderHeaders()}),res);
  }
  const body=parseBody(req);
  if(req.method==='POST'&&!storyId)return relay(await fetch(`${base}/api/v1/visual-stories`,{method:'POST',headers:renderHeaders(),body:JSON.stringify(body)}),res);
  if(req.method==='PUT'&&storyId)return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}`,{method:'PUT',headers:renderHeaders(),body:JSON.stringify(body)}),res);
  if(req.method==='POST'&&storyId&&action==='refine')return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}/refine`,{method:'POST',headers:renderHeaders(),body:JSON.stringify(body)}),res);
  if(req.method==='POST'&&storyId&&versionRaw)return relay(await fetch(`${base}/api/v1/visual-stories/${encodeURIComponent(storyId)}/versions/${encodeURIComponent(versionRaw)}`,{method:'POST',headers:renderHeaders(),body:'{}'}),res);
  return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
}

async function carousel(req,res,base){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!base)return res.status(503).json({error:'RENDER_PLANE_NOT_CONFIGURED'});
  const body=parseBody(req),storyId=body.storyId;
  if(storyId&&!safeId(storyId))return res.status(400).json({error:'INVALID_STORY_ID'});
  const raw=Number(body.itemsPerSlide??2),itemsPerSlide=Number.isFinite(raw)?Math.max(1,Math.min(4,Math.trunc(raw))):2;
  const path=storyId?`/api/v1/visual-stories/${encodeURIComponent(storyId)}/carousel`:'/api/v1/visual-stories/carousel';
  const payload=storyId?{itemsPerSlide}:{spec:body.spec,itemsPerSlide};
  return relay(await fetch(base+path,{method:'POST',headers:renderHeaders(),body:JSON.stringify(payload)}),res);
}

module.exports=async function(req,res){
  const op=String(first(req.query?.op)||'plan');
  try{
    if(op==='plan')return planner(req,res);
    if(op==='icons')return icons(req,res);
    const base=renderPlane();
    if(op==='render')return render(req,res,base);
    if(op==='storage')return storage(req,res,base);
    if(op==='carousel')return carousel(req,res,base);
    return res.status(404).json({error:'UNKNOWN_VISUAL_STORY_OPERATION'});
  }catch(error){return res.status(502).json({error:'RENDER_PLANE_UNAVAILABLE',message:error instanceof Error?error.message:String(error)});}
};
