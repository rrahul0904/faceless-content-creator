'use strict';
const crypto=require('node:crypto');
// Clean-room, offline, approval-gated transformation: no fetch, model or publishing.
const SCHEMA='creator-engineering-updates/v1';
function fail(code){const e=new Error(code);e.code=code;throw e;}
function id(s,code){if(typeof s!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(s))fail(code);return s;}
function repoName(s){if(typeof s!=='string'||!/^\w[\w.-]*\/\w[\w.-]*$/.test(s)||s.includes('..'))fail('INVALID_REPOSITORY');return s;}
function timestamp(s,asOf){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s))fail('INVALID_TIMESTAMP');
 const t=Date.parse(s);if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19)!==s.slice(0,19))fail('INVALID_TIMESTAMP');
 if(asOf&&t>Date.parse(asOf))fail('FUTURE_EVENT');return new Date(t).toISOString();
}
function title(s){
 if(typeof s!=='string'||!s.trim()||s.length>160)fail('INVALID_TITLE');
 if(/[\x00-\x1f\x7f<>]/.test(s))fail('UNSAFE_TITLE');
 if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|xox[baprs]-\S+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[A-Za-z0-9_-]{20,})/.test(s))fail('SENSITIVE_CONTENT');
 return s.trim();
}
function eventOf(e,repo,asOf){
 if(!e||typeof e!=='object'||Array.isArray(e)||!['commit','merged_pr','release'].includes(e.kind))fail('INVALID_EVENT');
 if(typeof e.sha!=='string'||!/^[a-fA-F0-9]{40}$/.test(e.sha))fail('INVALID_COMMIT_SHA');
 const safeTitle=title(e.title),occurredAt=timestamp(e.occurredAt,asOf);
 if(e.visibility!=='public')fail('PRIVATE_SOURCE_NOT_ALLOWED');
 if(e.authenticated!==true)fail('SOURCE_NOT_AUTHENTICATED');
 if(e.kind==='merged_pr'&&(!Number.isSafeInteger(e.number)||e.number<1||e.merged!==true))fail('INVALID_MERGE_PROOF');
 if(e.kind==='release'&&(typeof e.tag!=='string'||!/^[A-Za-z0-9][\w.-]{0,79}$/.test(e.tag)))fail('INVALID_RELEASE_TAG');
 let u;try{u=new URL(e.sourceUrl);}catch{fail('INVALID_SOURCE_URL');}
 if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||u.search||u.hash)fail('INVALID_SOURCE_URL');
 const [owner,name]=repo.split('/'),parts=u.pathname.split('/').filter(Boolean);
 if(parts.length<4||parts[0].toLowerCase()!==owner.toLowerCase()||parts[1].toLowerCase()!==name.toLowerCase())fail('SOURCE_REPOSITORY_MISMATCH');
 const match=e.kind==='commit'?parts.length===4&&parts[2]==='commit'&&parts[3].toLowerCase()===e.sha.toLowerCase()
 :e.kind==='merged_pr'?parts.length===4&&parts[2]==='pull'&&/^[1-9]\d*$/.test(parts[3])&&Number(parts[3])===e.number
 :parts.length===5&&parts[2]==='releases'&&parts[3]==='tag'&&parts[4]===e.tag;
 if(!match)fail('SOURCE_EVENT_MISMATCH');
 return {kind:e.kind,sha:e.sha.toLowerCase(),title:safeTitle,occurredAt,sourceUrl:u.toString(),...(e.kind==='merged_pr'?{number:e.number}:{}),...(e.kind==='release'?{tag:e.tag}:{})};
}
function hash(s){return crypto.createHash('sha256').update(s).digest('hex');}
function buildEngineeringUpdatePlan(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_INPUT');
 const workspaceId=id(input.workspaceId,'INVALID_WORKSPACE'),projectId=id(input.projectId,'INVALID_PROJECT'),repository=repoName(input.repository),asOf=timestamp(input.asOf);
 if(!Array.isArray(input.events)||input.events.length>100)fail('INVALID_EVENTS');
 const maxDrafts=input.maxDrafts===undefined?5:input.maxDrafts;
 if(!Number.isSafeInteger(maxDrafts)||maxDrafts<1||maxDrafts>10)fail('INVALID_DRAFT_LIMIT');
 const seen=new Set();
 const events=input.events.map(x=>eventOf(x,repository,asOf)).filter(x=>{const key=x.kind+'|'+x.sourceUrl+'|'+x.sha;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.sourceUrl.localeCompare(b.sourceUrl));
 const drafts=events.slice(0,maxDrafts).map(e=>{
  const summary=e.kind==='commit'?'Development update: '+e.title+'.':e.kind==='merged_pr'?'Merged pull request #'+e.number+': '+e.title+'.':'Tagged release '+e.tag+': '+e.title+'.';
  const evidence={kind:e.kind,sourceUrl:e.sourceUrl,commitSha:e.sha,occurredAt:e.occurredAt};
  return {id:hash(JSON.stringify([workspaceId,projectId,repository,evidence])).slice(0,24),type:'engineering_update',text:summary+'\n\nSource: '+e.sourceUrl+'\n\nPlease confirm the impact and wording before sharing.',evidence,workflowState:'needs_review',canSchedule:false,canPublish:false,verification:'source-reported-only'};
 });
 return {schema:SCHEMA,workspaceId,projectId,repository,asOf,digest:hash(JSON.stringify({schema:SCHEMA,workspaceId,projectId,repository,asOf,drafts})),drafts,rejectedPublication:true,notes:['URLs and source status are caller assertions, not remotely verified by this offline planner.','Do not promote drafts as shipped or verified without independently checked release/CI receipts.','Human approval and authorization are required in a separate publication integration.']};
}
module.exports={buildEngineeringUpdatePlan};
