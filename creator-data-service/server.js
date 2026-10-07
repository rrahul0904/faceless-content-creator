'use strict';

const http=require('node:http');
const {URL}=require('node:url');
const {timingSafeEqual,randomUUID}=require('node:crypto');
const {createCreatorStore}=require('./scoped-store');
const MAX_BODY_BYTES=2*1024*1024;
function send(res,status,body){const payload=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(payload)}
async function readJson(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY_BYTES)throw Object.assign(new Error('request body too large'),{status:413,code:'BODY_TOO_LARGE'});chunks.push(chunk)}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('invalid json body'),{status:400,code:'INVALID_JSON'})}}
function equalSecret(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb)}
function authenticated(req){const expected=process.env.CREATOR_DATA_TOKEN||'';if(!expected)return process.env.NODE_ENV==='test'||process.env.CREATOR_DATA_ALLOW_UNAUTHENTICATED==='1';return equalSecret(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''),expected)}
function requireMethod(req,res,allowed){if(allowed.includes(req.method))return true;send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',allowed});return false}
function publicHealth(store,runtimeInstanceId){const h=store.health();return{ok:h.ok,provider:h.provider,schemaVersion:h.schemaVersion,counts:h.counts||{briefs:h.briefCount||0},service:'creator-data-service',apiSchema:'creator-data-api/v1',runtimeInstanceId}}
function buildServer(options={}){const store=options.store||createCreatorStore(options),runtimeInstanceId=String(options.runtimeInstanceId||randomUUID());const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/','http://localhost');try{
  if(req.method==='GET'&&url.pathname==='/health')return send(res,200,publicHealth(store,runtimeInstanceId));
  if(!authenticated(req))return send(res,401,{ok:false,code:'UNAUTHORIZED',error:'Bearer token required'});
  if(url.pathname==='/v1/profile'){
    if(!requireMethod(req,res,['GET','PUT']))return;
    if(req.method==='GET')return send(res,200,{ok:true,data:store.getProfile()});
    return send(res,200,{ok:true,data:store.saveProfile(await readJson(req))});
  }
  if(url.pathname==='/v1/research'){
    if(!requireMethod(req,res,['GET','PUT']))return;
    if(req.method==='GET')return send(res,200,{ok:true,data:store.listResearch(Number(url.searchParams.get('limit')||100))});
    const body=await readJson(req);return send(res,200,{ok:true,data:store.saveResearch(Array.isArray(body)?body:(body.items||[]))});
  }
  if(url.pathname==='/v1/drafts'){
    if(!requireMethod(req,res,['GET','PUT']))return;
    if(req.method==='GET')return send(res,200,{ok:true,data:store.listDrafts(Number(url.searchParams.get('limit')||50))});
    return send(res,200,{ok:true,data:store.saveDraft(await readJson(req))});
  }
  if(url.pathname==='/v1/publications'){
    if(!requireMethod(req,res,['GET','POST']))return;
    if(req.method==='GET')return send(res,200,{ok:true,data:store.listPublications(Number(url.searchParams.get('limit')||50))});
    return send(res,201,{ok:true,data:store.savePublication(await readJson(req))});
  }
  if(req.method==='GET'&&url.pathname==='/v1/briefs')return send(res,200,{ok:true,data:store.listBriefs(Number(url.searchParams.get('limit')||50))});
  const match=url.pathname.match(/^\/v1\/briefs\/([^/]+)$/);
  if(match){const id=decodeURIComponent(match[1]);if(!requireMethod(req,res,['GET','PUT']))return;if(req.method==='GET'){const bundle=store.getBundle(id);return bundle?send(res,200,{ok:true,data:bundle,receipt:store.latestReceipt(id)}):send(res,404,{ok:false,code:'NOT_FOUND',error:'Content Brief not found'})}const body=await readJson(req),bodyId=String(body?.brief?.id||body?.id||'');if(bodyId&&bodyId!==id)return send(res,409,{ok:false,code:'BRIEF_ID_MISMATCH',error:'Path brief id does not match body brief id'});const saved=store.saveBundle(body?.brief?body:{...body,id});return send(res,200,{ok:true,data:{schema:saved.schema,brief:saved.brief,sources:saved.sources,claims:saved.claims},receipt:saved.receipt})}
  return send(res,404,{ok:false,code:'NOT_FOUND',error:'Route not found'});
}catch(error){return send(res,Number(error?.status||500),{ok:false,code:error?.code||'INTERNAL_ERROR',error:error instanceof Error?error.message:'Internal error'})}});return{server,store,runtimeInstanceId}}
if(require.main===module){const{server,store,runtimeInstanceId}=buildServer(),port=Math.max(1,Number(process.env.PORT||8787)),host=process.env.HOST||'0.0.0.0';server.listen(port,host,()=>process.stdout.write(JSON.stringify({event:'creator-data-service.ready',host,port,provider:store.health().provider,runtimeInstanceId})+'\n'));const shutdown=()=>server.close(()=>{store.close();process.exit(0)});process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)}
module.exports={buildServer,readJson,authenticated,publicHealth};
