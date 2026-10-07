'use strict';

function config(){
  const url=String(process.env.CREATOR_DATA_API_URL||'').replace(/\/$/,'');
  const token=String(process.env.CREATOR_DATA_API_TOKEN||process.env.CREATOR_DATA_TOKEN||'');
  const briefs=Boolean(url&&token);
  return{configured:briefs,provider:'creator-data-api',url,token,capabilities:{briefs,research:false,drafts:false,profile:false,publications:false,analytics:false}};
}

async function request(path,{method='GET',body}={}){
  const c=config();
  if(!c.configured)throw Object.assign(new Error('Creator Data Service is not configured'),{code:'STORAGE_NOT_CONFIGURED'});
  const r=await fetch(`${c.url}/v1/${String(path||'').replace(/^\/+/, '')}`,{method,headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let payload=null;try{payload=text?JSON.parse(text):null}catch{payload={raw:text.slice(0,2000)}}
  if(!r.ok)throw Object.assign(new Error(payload?.error||payload?.message||`Creator Data Service request failed: ${r.status}`),{code:payload?.code||'STORAGE_REQUEST_FAILED',status:r.status,details:payload});
  return payload?.data??payload;
}

async function health(){
  const c=config();
  if(!c.configured)return{ok:false,configured:false,connected:false,provider:c.provider,capabilities:c.capabilities};
  try{const r=await fetch(`${c.url}/health`,{headers:{Accept:'application/json'}});const payload=await r.json().catch(()=>({}));return{ok:r.ok&&payload?.ok===true,configured:true,connected:r.ok&&payload?.ok===true,provider:c.provider,capabilities:c.capabilities,service:payload};}
  catch(e){return{ok:false,configured:true,connected:false,provider:c.provider,capabilities:c.capabilities,error:String(e?.message||e)}}
}

async function saveBriefBundle(bundle={}){const brief=bundle.brief||bundle,id=String(brief?.id||'');if(!id||!String(brief?.topic||'').trim())throw Object.assign(new Error('brief id and topic are required'),{code:'INVALID_BRIEF'});return request(`briefs/${encodeURIComponent(id)}`,{method:'PUT',body:{brief,sources:Array.isArray(bundle.sources)?bundle.sources:[],claims:Array.isArray(bundle.claims)?bundle.claims:[]}})}
async function getBriefBundle(id){return request(`briefs/${encodeURIComponent(String(id||''))}`)}
async function listBriefs(limit=50){return request(`briefs?limit=${Math.max(1,Math.min(200,Number(limit||50)))}`)}
function unsupported(capability){throw Object.assign(new Error(`${capability} persistence is not implemented in Creator Data Service v1`),{code:'STORAGE_CAPABILITY_NOT_CONFIGURED',details:{capability}})}
async function saveResearch(){return unsupported('research')}async function listResearch(){return unsupported('research')}async function saveDraft(){return unsupported('drafts')}async function listDrafts(){return unsupported('drafts')}async function saveProfile(){return unsupported('profile')}async function getProfile(){return unsupported('profile')}async function savePublication(){return unsupported('publications')}async function listPublications(){return unsupported('publications')}

module.exports={config,health,request,saveBriefBundle,getBriefBundle,listBriefs,saveResearch,listResearch,saveDraft,listDrafts,saveProfile,getProfile,savePublication,listPublications};
