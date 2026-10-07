'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {buildServer}=require('../server');

function tempDb(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'creator-host-cert-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'creator.sqlite')}
async function start(dbPath){const app=buildServer({dbPath});await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});return{...app,base:`http://127.0.0.1:${app.server.address().port}`}}
async function stop(app){await new Promise(resolve=>app.server.close(resolve));app.store.close()}
function runCert(base,phase,extra={}){return spawnSync(process.execPath,[path.join(__dirname,'..','scripts','certify-hosted.js'),phase],{encoding:'utf8',env:{...process.env,CREATOR_DATA_URL:base,CREATOR_DATA_TOKEN:'test-token',...extra}})}

test('hosted certification rejects recover on the same runtime and passes after replacement',async t=>{
  const prior=process.env.CREATOR_DATA_TOKEN;process.env.CREATOR_DATA_TOKEN='test-token';t.after(()=>{if(prior===undefined)delete process.env.CREATOR_DATA_TOKEN;else process.env.CREATOR_DATA_TOKEN=prior});
  const dbPath=tempDb(t);let app=await start(dbPath);
  const prepared=runCert(app.base,'prepare');assert.equal(prepared.status,0,prepared.stderr);const receipt=JSON.parse(prepared.stdout);assert.equal(receipt.schema,'creator-hosted-certification/v2');assert.ok(receipt.briefId);assert.equal(receipt.runtimeInstanceId,app.runtimeInstanceId);
  const same=runCert(app.base,'recover',{CERT_BRIEF_ID:receipt.briefId,CERT_PREVIOUS_INSTANCE_ID:receipt.runtimeInstanceId});assert.notEqual(same.status,0);const sameError=JSON.parse(same.stderr);assert.match(sameError.error,/did not change/);
  await stop(app);app=await start(dbPath);t.after(()=>stop(app));assert.notEqual(app.runtimeInstanceId,receipt.runtimeInstanceId);
  const recovered=runCert(app.base,'recover',{CERT_BRIEF_ID:receipt.briefId,CERT_PREVIOUS_INSTANCE_ID:receipt.runtimeInstanceId});assert.equal(recovered.status,0,recovered.stderr);const recovery=JSON.parse(recovered.stdout);assert.equal(recovery.schema,'creator-hosted-certification/v2');assert.equal(recovery.serviceReplacementVerified,true);assert.equal(recovery.restartRecoveryVerified,true);assert.equal(recovery.previousRuntimeInstanceId,receipt.runtimeInstanceId);assert.equal(recovery.runtimeInstanceId,app.runtimeInstanceId);
});
