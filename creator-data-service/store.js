'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function receiptHash(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function json(value, fallback) { return JSON.stringify(value === undefined ? fallback : value); }
function parseJson(value, fallback) { if (value === null || value === undefined || value === '') return fallback; try { return JSON.parse(value); } catch { return fallback; } }
function nowIso() { return new Date().toISOString(); }
function boundedLimit(value, fallback = 50, max = 250) { return Math.max(1, Math.min(max, Number(value) || fallback)); }

function createCreatorStore(options = {}) {
  const dbPath = options.dbPath || process.env.CREATOR_DATA_DB || path.join(process.env.CREATOR_DATA_DIR || path.join(process.cwd(), 'data'), 'creator.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS creator_content_briefs (
      id TEXT PRIMARY KEY, topic TEXT NOT NULL, status TEXT NOT NULL, mode TEXT NOT NULL,
      trigger_text TEXT NOT NULL, audience TEXT NOT NULL, teaching_outcome TEXT NOT NULL,
      creator_take TEXT NOT NULL, platforms_json TEXT NOT NULL, artifact_plan_json TEXT,
      warnings_json TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_sources (
      id TEXT PRIMARY KEY, brief_id TEXT NOT NULL REFERENCES creator_content_briefs(id) ON DELETE CASCADE,
      url TEXT NOT NULL, canonical_url TEXT NOT NULL, evidence_class TEXT NOT NULL, title TEXT NOT NULL,
      publisher TEXT NOT NULL, published_at TEXT, captured_at TEXT NOT NULL, snapshot_hash TEXT,
      user_note TEXT NOT NULL, resolution_status TEXT NOT NULL, source_locator_json TEXT, payload_json TEXT NOT NULL,
      UNIQUE(brief_id, canonical_url)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_claims (
      id TEXT PRIMARY KEY, brief_id TEXT NOT NULL REFERENCES creator_content_briefs(id) ON DELETE CASCADE,
      claim_text TEXT NOT NULL, claim_type TEXT NOT NULL, status TEXT NOT NULL, confidence TEXT NOT NULL,
      supporting_source_ids_json TEXT NOT NULL, caveat TEXT NOT NULL, payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_profiles (
      id TEXT PRIMARY KEY, identity_json TEXT NOT NULL, voice_json TEXT NOT NULL, expertise_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_research_items (
      id TEXT PRIMARY KEY, source_url TEXT NOT NULL UNIQUE, vendor TEXT NOT NULL, topic TEXT NOT NULL,
      published_at TEXT, status TEXT NOT NULL, payload_json TEXT NOT NULL, discovered_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, platform TEXT NOT NULL, topic TEXT NOT NULL,
      content TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, run_receipt_json TEXT,
      approval_receipt_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(run_id, platform, version)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS creator_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, platform TEXT NOT NULL, external_id TEXT,
      draft_hash TEXT NOT NULL, publication_receipt_json TEXT NOT NULL, published_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS audit_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, brief_id TEXT NOT NULL, operation TEXT NOT NULL,
      receipt_hash TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS creator_content_briefs_updated_idx ON creator_content_briefs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS creator_sources_brief_idx ON creator_sources(brief_id, captured_at ASC);
    CREATE INDEX IF NOT EXISTS creator_claims_brief_idx ON creator_claims(brief_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS creator_research_published_idx ON creator_research_items(published_at DESC);
    CREATE INDEX IF NOT EXISTS creator_drafts_created_idx ON creator_drafts(created_at DESC);
    CREATE INDEX IF NOT EXISTS creator_publications_published_idx ON creator_publications(published_at DESC);
    CREATE INDEX IF NOT EXISTS audit_receipts_brief_idx ON audit_receipts(brief_id, created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(1, nowIso());
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(2, nowIso());

  const upsertBrief = db.prepare(`INSERT INTO creator_content_briefs (
    id,topic,status,mode,trigger_text,audience,teaching_outcome,creator_take,platforms_json,artifact_plan_json,warnings_json,payload_json,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    topic=excluded.topic,status=excluded.status,mode=excluded.mode,trigger_text=excluded.trigger_text,audience=excluded.audience,
    teaching_outcome=excluded.teaching_outcome,creator_take=excluded.creator_take,platforms_json=excluded.platforms_json,
    artifact_plan_json=excluded.artifact_plan_json,warnings_json=excluded.warnings_json,payload_json=excluded.payload_json,updated_at=excluded.updated_at`);
  const upsertSource = db.prepare(`INSERT INTO creator_sources (
    id,brief_id,url,canonical_url,evidence_class,title,publisher,published_at,captured_at,snapshot_hash,user_note,resolution_status,source_locator_json,payload_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    brief_id=excluded.brief_id,url=excluded.url,canonical_url=excluded.canonical_url,evidence_class=excluded.evidence_class,title=excluded.title,
    publisher=excluded.publisher,published_at=excluded.published_at,captured_at=excluded.captured_at,snapshot_hash=excluded.snapshot_hash,
    user_note=excluded.user_note,resolution_status=excluded.resolution_status,source_locator_json=excluded.source_locator_json,payload_json=excluded.payload_json`);
  const upsertClaim = db.prepare(`INSERT INTO creator_claims (
    id,brief_id,claim_text,claim_type,status,confidence,supporting_source_ids_json,caveat,payload_json,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    brief_id=excluded.brief_id,claim_text=excluded.claim_text,claim_type=excluded.claim_type,status=excluded.status,confidence=excluded.confidence,
    supporting_source_ids_json=excluded.supporting_source_ids_json,caveat=excluded.caveat,payload_json=excluded.payload_json,updated_at=excluded.updated_at`);

  function normalizeBundle(input = {}) {
    const brief = input.brief || input;
    if (!brief || !String(brief.id || '').trim() || !String(brief.topic || '').trim()) throw Object.assign(new Error('brief.id and brief.topic are required'), { code: 'INVALID_BRIEF' });
    const briefId = String(brief.id), sources = Array.isArray(input.sources || brief.sources) ? (input.sources || brief.sources) : [], claims = Array.isArray(input.claims || brief.claims) ? (input.claims || brief.claims) : [];
    for (const source of sources) if (!source?.id || !source?.url) throw Object.assign(new Error('source.id and source.url are required'), { code: 'INVALID_SOURCE' });
    for (const claim of claims) if (!claim?.id || !claim?.text) throw Object.assign(new Error('claim.id and claim.text are required'), { code: 'INVALID_CLAIM' });
    return { briefId, brief, sources, claims };
  }
  function saveBundle(input) {
    const { briefId, brief, sources, claims } = normalizeBundle(input), timestamp = nowIso();
    const existing = db.prepare('SELECT created_at FROM creator_content_briefs WHERE id=?').get(briefId);
    db.exec('BEGIN IMMEDIATE');
    try {
      upsertBrief.run(briefId,String(brief.topic),String(brief.status||'captured'),String(brief.mode||'factual-explainer'),String(brief.trigger||''),String(brief.audience||''),String(brief.teachingOutcome||brief.teaching_outcome||''),String(brief.creatorTake||brief.creator_take||''),json(Array.isArray(brief.platforms)?brief.platforms:[],[]),brief.artifactPlan||brief.artifact_plan?json(brief.artifactPlan||brief.artifact_plan,null):null,json(Array.isArray(brief.warnings)?brief.warnings:[],[]),json(brief,{}),existing?.created_at||timestamp,timestamp);
      const sourceIds=[];
      for(const source of sources){sourceIds.push(String(source.id));upsertSource.run(String(source.id),briefId,String(source.url),String(source.canonicalUrl||source.url),String(source.evidenceClass||''),String(source.title||''),String(source.publisher||''),source.publishedAt||null,source.capturedAt||timestamp,source.snapshotHash||null,String(source.userNote||''),String(source.resolutionStatus||'resolved'),source.sourceLocator?json(source.sourceLocator,null):null,json(source,{}));}
      if(sourceIds.length){const q=sourceIds.map(()=>'?').join(',');db.prepare(`DELETE FROM creator_sources WHERE brief_id=? AND id NOT IN (${q})`).run(briefId,...sourceIds)}else db.prepare('DELETE FROM creator_sources WHERE brief_id=?').run(briefId);
      const claimIds=[];
      for(const claim of claims){claimIds.push(String(claim.id));const old=db.prepare('SELECT created_at FROM creator_claims WHERE id=?').get(String(claim.id));upsertClaim.run(String(claim.id),briefId,String(claim.text),String(claim.claimType||'fact'),String(claim.status||'unresolved'),String(claim.confidence||'unknown'),json(Array.isArray(claim.supportingSourceIds)?claim.supportingSourceIds:[],[]),String(claim.caveat||''),json(claim,{}),old?.created_at||timestamp,timestamp)}
      if(claimIds.length){const q=claimIds.map(()=>'?').join(',');db.prepare(`DELETE FROM creator_claims WHERE brief_id=? AND id NOT IN (${q})`).run(briefId,...claimIds)}else db.prepare('DELETE FROM creator_claims WHERE brief_id=?').run(briefId);
      const persisted=getBundle(briefId),hash=receiptHash(persisted);db.prepare('INSERT INTO audit_receipts(brief_id,operation,receipt_hash,payload_json,created_at) VALUES(?,?,?,?,?)').run(briefId,'save-bundle',hash,json({briefId,sourceIds,claimIds},{}),timestamp);db.exec('COMMIT');
      return{...persisted,receipt:{schema:'creator-data-receipt/v1',briefId,operation:'save-bundle',hash,createdAt:timestamp}};
    }catch(error){db.exec('ROLLBACK');throw error}
  }
  function mapBrief(row){if(!row)return null;return{...parseJson(row.payload_json,{}),id:row.id,topic:row.topic,status:row.status,mode:row.mode,trigger:row.trigger_text,audience:row.audience,teachingOutcome:row.teaching_outcome,creatorTake:row.creator_take,platforms:parseJson(row.platforms_json,[]),artifactPlan:parseJson(row.artifact_plan_json,null),warnings:parseJson(row.warnings_json,[]),createdAt:row.created_at,updatedAt:row.updated_at}}
  function mapSource(row){return{...parseJson(row.payload_json,{}),id:row.id,briefId:row.brief_id,url:row.url,canonicalUrl:row.canonical_url,evidenceClass:row.evidence_class,title:row.title,publisher:row.publisher,publishedAt:row.published_at,capturedAt:row.captured_at,snapshotHash:row.snapshot_hash,userNote:row.user_note,resolutionStatus:row.resolution_status,sourceLocator:parseJson(row.source_locator_json,null)}}
  function mapClaim(row){return{...parseJson(row.payload_json,{}),id:row.id,briefId:row.brief_id,text:row.claim_text,claimType:row.claim_type,status:row.status,confidence:row.confidence,supportingSourceIds:parseJson(row.supporting_source_ids_json,[]),caveat:row.caveat,createdAt:row.created_at,updatedAt:row.updated_at}}
  function getBundle(id){const brief=mapBrief(db.prepare('SELECT * FROM creator_content_briefs WHERE id=?').get(String(id)));if(!brief)return null;return{schema:'creator-content-bundle/v1',brief,sources:db.prepare('SELECT * FROM creator_sources WHERE brief_id=? ORDER BY captured_at ASC,id ASC').all(String(id)).map(mapSource),claims:db.prepare('SELECT * FROM creator_claims WHERE brief_id=? ORDER BY created_at ASC,id ASC').all(String(id)).map(mapClaim)}}
  function listBriefs(limit=50){return db.prepare('SELECT * FROM creator_content_briefs ORDER BY updated_at DESC LIMIT ?').all(boundedLimit(limit,50,200)).map(mapBrief)}
  function latestReceipt(briefId){const row=db.prepare('SELECT * FROM audit_receipts WHERE brief_id=? ORDER BY id DESC LIMIT 1').get(String(briefId));return row?{schema:'creator-data-receipt/v1',briefId:row.brief_id,operation:row.operation,hash:row.receipt_hash,createdAt:row.created_at}:null}

  function saveProfile(profile={}){const timestamp=nowIso();db.prepare(`INSERT INTO creator_profiles(id,identity_json,voice_json,expertise_json,updated_at) VALUES('default',?,?,?,?) ON CONFLICT(id) DO UPDATE SET identity_json=excluded.identity_json,voice_json=excluded.voice_json,expertise_json=excluded.expertise_json,updated_at=excluded.updated_at`).run(json(profile.identity||{},{}),json(profile.voice||{},{}),json(Array.isArray(profile.expertise)?profile.expertise:[],[]),timestamp);return getProfile()}
  function getProfile(){const row=db.prepare("SELECT * FROM creator_profiles WHERE id='default'").get();return row?{id:'default',identity:parseJson(row.identity_json,{}),voice:parseJson(row.voice_json,{}),expertise:parseJson(row.expertise_json,[]),updatedAt:row.updated_at}:null}

  function saveResearch(items=[]){const timestamp=nowIso(),rows=[];db.exec('BEGIN IMMEDIATE');try{const stmt=db.prepare(`INSERT INTO creator_research_items(id,source_url,vendor,topic,published_at,status,payload_json,discovered_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_url=excluded.source_url,vendor=excluded.vendor,topic=excluded.topic,published_at=excluded.published_at,status=excluded.status,payload_json=excluded.payload_json,updated_at=excluded.updated_at`);for(const item of (Array.isArray(items)?items:[]).slice(0,100)){if(!item?.id||!item?.sourceUrl)continue;const old=db.prepare('SELECT discovered_at FROM creator_research_items WHERE id=?').get(String(item.id));stmt.run(String(item.id),String(item.sourceUrl),String(item.vendor||''),String(item.topic||item.sourceTitle||''),item.publishedAt||null,String(item.status||'discovered'),json(item,{}),old?.discovered_at||timestamp,timestamp);rows.push(item)}db.exec('COMMIT');return rows}catch(error){db.exec('ROLLBACK');throw error}}
  function listResearch(limit=100){return db.prepare('SELECT payload_json FROM creator_research_items ORDER BY COALESCE(published_at,discovered_at) DESC LIMIT ?').all(boundedLimit(limit,100,250)).map(r=>parseJson(r.payload_json,{}))}

  function saveDraft(d={}){const runId=String(d.runId||d.run_id||''),platform=String(d.platform||''),topic=String(d.topic||''),content=String(d.content||''),version=Math.max(1,Number(d.version||1));if(!runId||!platform||!topic||!content)throw Object.assign(new Error('runId, platform, topic and content are required'),{code:'INVALID_DRAFT'});const timestamp=nowIso(),old=db.prepare('SELECT created_at FROM creator_drafts WHERE run_id=? AND platform=? AND version=?').get(runId,platform,version);db.prepare(`INSERT INTO creator_drafts(run_id,platform,topic,content,status,version,run_receipt_json,approval_receipt_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(run_id,platform,version) DO UPDATE SET topic=excluded.topic,content=excluded.content,status=excluded.status,run_receipt_json=excluded.run_receipt_json,approval_receipt_json=excluded.approval_receipt_json,updated_at=excluded.updated_at`).run(runId,platform,topic,content,String(d.status||'draft'),version,d.runReceipt||d.run_receipt?json(d.runReceipt||d.run_receipt,null):null,d.approvalReceipt||d.approval_receipt?json(d.approvalReceipt||d.approval_receipt,null):null,old?.created_at||timestamp,timestamp);return mapDraft(db.prepare('SELECT * FROM creator_drafts WHERE run_id=? AND platform=? AND version=?').get(runId,platform,version))}
  function mapDraft(row){return{runId:row.run_id,platform:row.platform,topic:row.topic,content:row.content,status:row.status,version:row.version,runReceipt:parseJson(row.run_receipt_json,null),approvalReceipt:parseJson(row.approval_receipt_json,null),createdAt:row.created_at,updatedAt:row.updated_at}}
  function listDrafts(limit=50){return db.prepare('SELECT * FROM creator_drafts ORDER BY created_at DESC,id DESC LIMIT ?').all(boundedLimit(limit,50,200)).map(mapDraft)}

  function savePublication(p={}){const runId=String(p.runId||''),platform=String(p.platform||''),draftHash=String(p.draftHash||'');if(!runId||!platform||!draftHash)throw Object.assign(new Error('runId, platform and draftHash are required'),{code:'INVALID_PUBLICATION'});const timestamp=p.publishedAt||new Date().toISOString(),receipt=p.receipt||p;const result=db.prepare('INSERT INTO creator_publications(run_id,platform,external_id,draft_hash,publication_receipt_json,published_at) VALUES(?,?,?,?,?,?)').run(runId,platform,p.externalId||p.postId||null,draftHash,json(receipt,{}),timestamp);return mapPublication(db.prepare('SELECT * FROM creator_publications WHERE id=?').get(result.lastInsertRowid))}
  function mapPublication(row){return{id:row.id,runId:row.run_id,platform:row.platform,externalId:row.external_id,draftHash:row.draft_hash,receipt:parseJson(row.publication_receipt_json,{}),publishedAt:row.published_at}}
  function listPublications(limit=50){return db.prepare('SELECT * FROM creator_publications ORDER BY published_at DESC,id DESC LIMIT ?').all(boundedLimit(limit,50,200)).map(mapPublication)}

  function health(){const schemaVersion=db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get()?.version||0;return{ok:true,provider:'creator-sqlite',schemaVersion,dbPath,counts:{briefs:db.prepare('SELECT COUNT(*) AS c FROM creator_content_briefs').get().c,research:db.prepare('SELECT COUNT(*) AS c FROM creator_research_items').get().c,drafts:db.prepare('SELECT COUNT(*) AS c FROM creator_drafts').get().c,publications:db.prepare('SELECT COUNT(*) AS c FROM creator_publications').get().c}}}
  function close(){db.close()}
  return{dbPath,saveBundle,getBundle,listBriefs,latestReceipt,saveProfile,getProfile,saveResearch,listResearch,saveDraft,listDrafts,savePublication,listPublications,health,close};
}

module.exports={createCreatorStore,receiptHash,canonical};
