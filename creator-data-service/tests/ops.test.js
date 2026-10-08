'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createCreatorStore}=require('../store');
const {checkIntegrity,createBackup,sha256File}=require('../ops');

function tempDir(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'creator-data-ops-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
function fixture(){return{brief:{id:'ops-brief',topic:'Backup certification',status:'evidence-ready',mode:'analysis',teachingOutcome:'Prove recoverability',creatorTake:'A backup only counts after restore verification.'},sources:[{id:'ops-source',url:'https://example.com/ops',canonicalUrl:'https://example.com/ops',evidenceClass:'official-doc',title:'Ops evidence',publisher:'Creator Console',resolutionStatus:'resolved',sourceLocator:{kind:'transcript',startSeconds:12,endSeconds:18,passage:'backup preserves provenance'}}],claims:[{id:'ops-claim',text:'Backup preserves the evidence bundle.',claimType:'fact',status:'supported',confidence:'high',supportingSourceIds:['ops-source']}]}}

test('integrity check passes for a valid creator database',t=>{const dir=tempDir(t),dbPath=path.join(dir,'creator.sqlite'),store=createCreatorStore({dbPath});store.saveBundle(fixture());store.close();const result=checkIntegrity({dbPath});assert.equal(result.ok,true);assert.equal(result.foreignKeyViolations.length,0);assert.ok(result.bytes>0)});

test('verified backup can be reopened with creator state and provenance intact',t=>{const dir=tempDir(t),dbPath=path.join(dir,'creator.sqlite'),backupPath=path.join(dir,'backup.sqlite');let store=createCreatorStore({dbPath});store.saveBundle(fixture());store.saveProfile({identity:{displayName:'Synthetic Creator'},voice:{tone:'technical'},expertise:['data architecture']});store.close();const receipt=createBackup({dbPath,backupPath});assert.equal(receipt.ok,true);assert.match(receipt.sha256,/^[a-f0-9]{64}$/);assert.equal(receipt.sha256,sha256File(backupPath));store=createCreatorStore({dbPath:backupPath});const recovered=store.getBundle('ops-brief');assert.equal(recovered.brief.id,'ops-brief');assert.equal(recovered.sources[0].sourceLocator.startSeconds,12);assert.equal(recovered.sources[0].sourceLocator.passage,'backup preserves provenance');assert.deepEqual(recovered.claims[0].supportingSourceIds,['ops-source']);assert.equal(store.getProfile().identity.displayName,'Synthetic Creator');store.close()});

test('backup refuses a missing source database',t=>{const dir=tempDir(t),missing=path.join(dir,'missing.sqlite');assert.equal(checkIntegrity({dbPath:missing}).ok,false);assert.throws(()=>createBackup({dbPath:missing,backupPath:path.join(dir,'backup.sqlite')}),error=>error.code==='SOURCE_INTEGRITY_FAILED')});
