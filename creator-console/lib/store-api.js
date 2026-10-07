'use strict';

function config(){
  const url=String(process.env.CREATOR_DATA_URL||process.env.CREATOR_DATA_API_URL||'').replace(/\/$/,'');
  const token=String(process.env.CREATOR_DATA_TOKEN||process.env.CREATOR_DATA_API_TOKEN||'');
  const configured=Boolean(url&&token);
  return{configured,provider:'creator-data-service',url,capabilities:{briefs:configured,drafts:configured,research:configured,profile:configured,publications:configured}};
}
function storageError(message='Creator Data Service is not configured'){return Object.assign(new Error(message),{code:'STORAGE_NOT_CONFIGURED'})}
async function request(path,{method='GET',body,allowNotFound=false}={}){
  const c=config();if(!c.configured)throw storageError();
  const r=await fetch(`${c.url}${String(path||'').startsWith('/')?path:`/${path}`}`,{method,headers:{Authorization:`Bearer ${String(process.env.CREATOR_DATA_TOKEN||process.env.CREATOR_DATA_API_TOKEN||'')}`,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let payload=null;try{payload=text?JSON.parse(text):null}catch{payload={raw:text.slice(0,2000)}}
  if(allowNotFound&&r.status===404)return null;
  if(!r.ok)throw Object.assign(new Error(payload?.error||payload?.message||`Creator Data Service request failed: ${r.status}`),{code:payload?.code||'STORAGE_REQUEST_FAILED',status:r.status,details:payload});
  return payload;
}
async function health(){const c=config();if(!c.configured)return{ok:false,configured:false,connected:false,provider:c.provider,capabilities:c.capabilities};try{const r=await fetch(`${c.url}/health`,{headers:{Accept:'application/json'}});const payload=await r.json().catch(()=>({}));return{ok:r.ok&&payload?.ok===true,configured:true,connected:r.ok&&payload?.ok===true,provider:c.provider,capabilities:c.capabilities,service:payload}}catch(e){return{ok:false,configured:true,connected:false,provider:c.provider,capabilities:c.capabilities,error:String(e?.message||e)}}}

async function saveProfile(profile={}){return(await request('/v1/profile',{method:'PUT',body:profile}))?.data||null}
async function getProfile(){return(await request('/v1/profile'))?.data||null}
async function saveResearch(items=[]){return(await request('/v1/research',{method:'PUT',body:{items:Array.isArray(items)?items:[]}}))?.data||[]}
async function listResearch(limit=100){return(await request(`/v1/research?limit=${Math.max(1,Math.min(250,Number(limit||100)))}`))?.data||[]}
async function saveDraft(draft={}){return(await request('/v1/drafts',{method:'PUT',body:draft}))?.data||null}
async function listDrafts(limit=50){return(await request(`/v1/drafts?limit=${Math.max(1,Math.min(200,Number(limit||50)))}`))?.data||[]}
async function savePublication(publication={}){return(await request('/v1/publications',{method:'POST',body:publication}))?.data||null}
async function listPublications(limit=50){return(await request(`/v1/publications?limit=${Math.max(1,Math.min(200,Number(limit||50)))}`))?.data||[]}
async function saveBriefBundle(bundle={}){const brief=bundle.brief||bundle,id=String(brief?.id||'');if(!id||!String(brief?.topic||'').trim())throw Object.assign(new Error('brief id and topic are required'),{code:'INVALID_BRIEF'});return(await request(`/v1/briefs/${encodeURIComponent(id)}`,{method:'PUT',body:{brief,sources:Array.isArray(bundle.sources)?bundle.sources:[],claims:Array.isArray(bundle.claims)?bundle.claims:[]}}))?.data||null}
async function getBriefBundle(id){const r=await request(`/v1/briefs/${encodeURIComponent(String(id||''))}`,{allowNotFound:true});return r?.data||null}
async function listBriefs(limit=50){return(await request(`/v1/briefs?limit=${Math.max(1,Math.min(200,Number(limit||50)))}`))?.data||[]}
async function saveBrief(brief={}){const current=await getBriefBundle(brief.id);const saved=await saveBriefBundle({brief,sources:current?.sources||[],claims:current?.claims||[]});return saved?[saved.brief]:[]}
async function getBrief(id){return(await getBriefBundle(id))?.brief||null}
async function saveSources(briefId,sources=[]){const current=await getBriefBundle(briefId);if(!current)throw Object.assign(new Error('brief not found'),{code:'BRIEF_NOT_FOUND',status:404});return(await saveBriefBundle({brief:current.brief,sources,claims:current.claims||[]})).sources}
async function listSources(briefId){return(await getBriefBundle(briefId))?.sources||[]}
async function saveClaims(briefId,claims=[]){const current=await getBriefBundle(briefId);if(!current)throw Object.assign(new Error('brief not found'),{code:'BRIEF_NOT_FOUND',status:404});return(await saveBriefBundle({brief:current.brief,sources:current.sources||[],claims})).claims}
async function listClaims(briefId){return(await getBriefBundle(briefId))?.claims||[]}
function capability(name){return Boolean(config().capabilities?.[name])}

module.exports={config,health,request,capability,saveProfile,getProfile,saveResearch,listResearch,saveDraft,listDrafts,savePublication,listPublications,saveBriefBundle,getBriefBundle,listBriefs,saveBrief,getBrief,saveSources,listSources,saveClaims,listClaims};
