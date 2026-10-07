'use strict';

const { createHash } = require('node:crypto');

const base = String(process.env.CREATOR_DATA_URL || process.env.CREATOR_DATA_API_URL || '').replace(/\/$/, '');
const token = String(process.env.CREATOR_DATA_TOKEN || process.env.CREATOR_DATA_API_TOKEN || '');
const phase = String(process.argv[2] || 'prepare').toLowerCase();
const requestedId = String(process.env.CERT_BRIEF_ID || process.argv[3] || '');
const previousRuntimeInstanceId = String(process.env.CERT_PREVIOUS_INSTANCE_ID || '');

function fail(message, code='CERTIFICATION_FAILED', details=null) {
  const error = new Error(message); error.code=code; error.details=details; throw error;
}
function assert(condition, message, details=null) { if (!condition) fail(message, 'CERTIFICATION_ASSERTION_FAILED', details); }
function idNow(){return `host-cert-${new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${Math.random().toString(16).slice(2,8)}`}
async function request(path,{method='GET',body}={}){
  const r=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let payload=null;try{payload=text?JSON.parse(text):null}catch{payload={raw:text.slice(0,1000)}}
  return{status:r.status,ok:r.ok,payload};
}
function verifyRecovered(body,id){
  const data=body?.data||body;
  assert(data?.brief?.id===id,'Brief id did not survive recovery',{expected:id,actual:data?.brief?.id});
  assert(data?.brief?.topic==='Hosted durability certification','Brief topic changed unexpectedly',{actual:data?.brief?.topic});
  assert(data?.sources?.[0]?.id==='cert-source','Source logical id did not survive recovery');
  assert(data?.sources?.[0]?.sourceLocator?.startSeconds===42,'Source timestamp provenance did not survive recovery');
  assert(data?.sources?.[0]?.sourceLocator?.passage==='persistent evidence passage','Source passage provenance did not survive recovery');
  assert(data?.claims?.[0]?.id==='cert-claim','Claim logical id did not survive recovery');
  assert(data?.claims?.[0]?.supportingSourceIds?.[0]==='cert-source','Claim/source relationship did not survive recovery');
  return data;
}
async function prepare(){
  const id=requestedId||idNow();
  const health=await request('/health');
  assert(health.ok&&health.payload?.ok===true,'Hosted data service health check failed',health);
  const runtimeInstanceId=String(health.payload?.runtimeInstanceId||'');
  assert(runtimeInstanceId,'Hosted data service health is missing runtimeInstanceId');
  const bundle={
    brief:{id,topic:'Hosted durability certification',status:'evidence-ready',mode:'analysis',trigger:'Slice A hosted certification',audience:'operator',teachingOutcome:'Prove persistent recovery',creatorTake:'Durability must be demonstrated through restart, not inferred from configuration.',platforms:['linkedin','medium']},
    sources:[{id:'cert-source',url:'https://example.com/creator-certification',canonicalUrl:'https://example.com/creator-certification',evidenceClass:'official-doc',title:'Certification evidence',publisher:'Creator Console',resolutionStatus:'resolved',sourceLocator:{kind:'transcript',startSeconds:42,endSeconds:55,passage:'persistent evidence passage'}}],
    claims:[{id:'cert-claim',text:'The hosted Creator Data Service preserves evidence identity across restart.',claimType:'fact',status:'supported',confidence:'high',supportingSourceIds:['cert-source'],caveat:'Certification applies to this deployed storage path.'}]
  };
  const saved=await request(`/v1/briefs/${encodeURIComponent(id)}`,{method:'PUT',body:bundle});
  assert(saved.ok,'Initial hosted bundle save failed',saved);
  const loaded=await request(`/v1/briefs/${encodeURIComponent(id)}`);
  assert(loaded.ok,'Initial hosted bundle reload failed',loaded);
  verifyRecovered(loaded.payload,id);

  const broken=JSON.parse(JSON.stringify(bundle));
  broken.brief.topic='THIS MUST ROLL BACK';
  broken.sources=[
    {...bundle.sources[0],id:'cert-source-a'},
    {...bundle.sources[0],id:'cert-source-b'},
  ];
  const failed=await request(`/v1/briefs/${encodeURIComponent(id)}`,{method:'PUT',body:broken});
  assert(!failed.ok,'Broken bundle unexpectedly committed',{status:failed.status,payload:failed.payload});
  const afterFailure=await request(`/v1/briefs/${encodeURIComponent(id)}`);
  assert(afterFailure.ok,'Reload after failed update failed',afterFailure);
  const recovered=verifyRecovered(afterFailure.payload,id);
  assert(recovered.brief.topic==='Hosted durability certification','Failed update was not rolled back');

  return {
    schema:'creator-hosted-certification/v2',phase:'prepare',ok:true,briefId:id,
    rollbackVerified:true,sourceLocatorVerified:true,runtimeInstanceId,
    saveReceipt:saved.payload?.receipt||null,
    recoveryFingerprint:createHash('sha256').update(JSON.stringify({id,sourceId:'cert-source',claimId:'cert-claim',startSeconds:42,passage:'persistent evidence passage'})).digest('hex'),
    next:`Restart or replace the hosted service while preserving its /data volume, then run: CERT_BRIEF_ID=${id} CERT_PREVIOUS_INSTANCE_ID=${runtimeInstanceId} npm run certify:hosted:recover`,
    preparedAt:new Date().toISOString(),
  };
}
async function recover(){
  const id=requestedId;
  assert(id,'CERT_BRIEF_ID or brief id argument is required for recover phase');
  assert(previousRuntimeInstanceId,'CERT_PREVIOUS_INSTANCE_ID from prepare phase is required for recover phase');
  const health=await request('/health');
  assert(health.ok&&health.payload?.ok===true,'Hosted data service health check failed after restart',health);
  const runtimeInstanceId=String(health.payload?.runtimeInstanceId||'');
  assert(runtimeInstanceId,'Hosted data service health is missing runtimeInstanceId after restart');
  assert(runtimeInstanceId!==previousRuntimeInstanceId,'Service runtime instance did not change; restart/replacement is not proven',{runtimeInstanceId,previousRuntimeInstanceId});
  const loaded=await request(`/v1/briefs/${encodeURIComponent(id)}`);
  assert(loaded.ok,'Hosted bundle could not be reloaded after restart',loaded);
  verifyRecovered(loaded.payload,id);
  return {schema:'creator-hosted-certification/v2',phase:'recover',ok:true,briefId:id,previousRuntimeInstanceId,runtimeInstanceId,serviceReplacementVerified:true,restartRecoveryVerified:true,sourceLocatorVerified:true,recoveredAt:new Date().toISOString(),receipt:loaded.payload?.receipt||null};
}

(async()=>{
  try{
    if(!base||!token)fail('CREATOR_DATA_URL and CREATOR_DATA_TOKEN are required','CERTIFICATION_NOT_CONFIGURED');
    const result=phase==='recover'?await recover():phase==='prepare'?await prepare():fail(`Unknown certification phase: ${phase}`,'INVALID_CERTIFICATION_PHASE');
    process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  }catch(error){
    process.stderr.write(`${JSON.stringify({schema:'creator-hosted-certification/v2',ok:false,phase,code:error.code||'CERTIFICATION_FAILED',error:String(error.message||error),details:error.details||null},null,2)}\n`);
    process.exitCode=1;
  }
})();
