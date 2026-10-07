'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function receiptHash(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function json(value, fallback) {
  if (value === undefined) return JSON.stringify(fallback);
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function nowIso() { return new Date().toISOString(); }

function createCreatorStore(options = {}) {
  const dbPath = options.dbPath || process.env.CREATOR_DATA_DB || path.join(process.env.CREATOR_DATA_DIR || path.join(process.cwd(), 'data'), 'creator.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS creator_content_briefs (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      trigger_text TEXT NOT NULL,
      audience TEXT NOT NULL,
      teaching_outcome TEXT NOT NULL,
      creator_take TEXT NOT NULL,
      platforms_json TEXT NOT NULL,
      artifact_plan_json TEXT,
      warnings_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS creator_sources (
      id TEXT PRIMARY KEY,
      brief_id TEXT NOT NULL REFERENCES creator_content_briefs(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      evidence_class TEXT NOT NULL,
      title TEXT NOT NULL,
      publisher TEXT NOT NULL,
      published_at TEXT,
      captured_at TEXT NOT NULL,
      snapshot_hash TEXT,
      user_note TEXT NOT NULL,
      resolution_status TEXT NOT NULL,
      source_locator_json TEXT,
      payload_json TEXT NOT NULL,
      UNIQUE(brief_id, canonical_url)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS creator_claims (
      id TEXT PRIMARY KEY,
      brief_id TEXT NOT NULL REFERENCES creator_content_briefs(id) ON DELETE CASCADE,
      claim_text TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence TEXT NOT NULL,
      supporting_source_ids_json TEXT NOT NULL,
      caveat TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS audit_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brief_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      receipt_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS creator_content_briefs_updated_idx ON creator_content_briefs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS creator_sources_brief_idx ON creator_sources(brief_id, captured_at ASC);
    CREATE INDEX IF NOT EXISTS creator_claims_brief_idx ON creator_claims(brief_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS audit_receipts_brief_idx ON audit_receipts(brief_id, created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(1, nowIso());

  const upsertBrief = db.prepare(`
    INSERT INTO creator_content_briefs (
      id, topic, status, mode, trigger_text, audience, teaching_outcome, creator_take,
      platforms_json, artifact_plan_json, warnings_json, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic=excluded.topic, status=excluded.status, mode=excluded.mode,
      trigger_text=excluded.trigger_text, audience=excluded.audience,
      teaching_outcome=excluded.teaching_outcome, creator_take=excluded.creator_take,
      platforms_json=excluded.platforms_json, artifact_plan_json=excluded.artifact_plan_json,
      warnings_json=excluded.warnings_json, payload_json=excluded.payload_json,
      updated_at=excluded.updated_at
  `);
  const upsertSource = db.prepare(`
    INSERT INTO creator_sources (
      id, brief_id, url, canonical_url, evidence_class, title, publisher, published_at,
      captured_at, snapshot_hash, user_note, resolution_status, source_locator_json, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      brief_id=excluded.brief_id, url=excluded.url, canonical_url=excluded.canonical_url,
      evidence_class=excluded.evidence_class, title=excluded.title, publisher=excluded.publisher,
      published_at=excluded.published_at, captured_at=excluded.captured_at,
      snapshot_hash=excluded.snapshot_hash, user_note=excluded.user_note,
      resolution_status=excluded.resolution_status, source_locator_json=excluded.source_locator_json,
      payload_json=excluded.payload_json
  `);
  const upsertClaim = db.prepare(`
    INSERT INTO creator_claims (
      id, brief_id, claim_text, claim_type, status, confidence, supporting_source_ids_json,
      caveat, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      brief_id=excluded.brief_id, claim_text=excluded.claim_text, claim_type=excluded.claim_type,
      status=excluded.status, confidence=excluded.confidence,
      supporting_source_ids_json=excluded.supporting_source_ids_json,
      caveat=excluded.caveat, payload_json=excluded.payload_json, updated_at=excluded.updated_at
  `);

  function normalizeBundle(input = {}) {
    const brief = input.brief || input;
    if (!brief || !String(brief.id || '').trim() || !String(brief.topic || '').trim()) {
      const error = new Error('brief.id and brief.topic are required');
      error.code = 'INVALID_BRIEF';
      throw error;
    }
    const briefId = String(brief.id);
    const sources = Array.isArray(input.sources || brief.sources) ? (input.sources || brief.sources) : [];
    const claims = Array.isArray(input.claims || brief.claims) ? (input.claims || brief.claims) : [];
    for (const source of sources) {
      if (!source?.id || !source?.url) throw Object.assign(new Error('source.id and source.url are required'), { code: 'INVALID_SOURCE' });
    }
    for (const claim of claims) {
      if (!claim?.id || !claim?.text) throw Object.assign(new Error('claim.id and claim.text are required'), { code: 'INVALID_CLAIM' });
    }
    return { briefId, brief, sources, claims };
  }

  function saveBundle(input) {
    const { briefId, brief, sources, claims } = normalizeBundle(input);
    const timestamp = nowIso();
    const existing = db.prepare('SELECT created_at FROM creator_content_briefs WHERE id=?').get(briefId);
    db.exec('BEGIN IMMEDIATE');
    try {
      upsertBrief.run(
        briefId,
        String(brief.topic),
        String(brief.status || 'captured'),
        String(brief.mode || 'factual-explainer'),
        String(brief.trigger || ''),
        String(brief.audience || ''),
        String(brief.teachingOutcome || brief.teaching_outcome || ''),
        String(brief.creatorTake || brief.creator_take || ''),
        json(Array.isArray(brief.platforms) ? brief.platforms : [], []),
        brief.artifactPlan || brief.artifact_plan ? json(brief.artifactPlan || brief.artifact_plan, null) : null,
        json(Array.isArray(brief.warnings) ? brief.warnings : [], []),
        json(brief, {}),
        existing?.created_at || timestamp,
        timestamp
      );

      const incomingSourceIds = [];
      for (const source of sources) {
        incomingSourceIds.push(String(source.id));
        upsertSource.run(
          String(source.id), briefId, String(source.url), String(source.canonicalUrl || source.url),
          String(source.evidenceClass || ''), String(source.title || ''), String(source.publisher || ''),
          source.publishedAt || null, source.capturedAt || timestamp, source.snapshotHash || null,
          String(source.userNote || ''), String(source.resolutionStatus || 'resolved'),
          source.sourceLocator ? json(source.sourceLocator, null) : null, json(source, {})
        );
      }
      if (incomingSourceIds.length) {
        const placeholders = incomingSourceIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM creator_sources WHERE brief_id=? AND id NOT IN (${placeholders})`).run(briefId, ...incomingSourceIds);
      } else {
        db.prepare('DELETE FROM creator_sources WHERE brief_id=?').run(briefId);
      }

      const incomingClaimIds = [];
      for (const claim of claims) {
        incomingClaimIds.push(String(claim.id));
        const old = db.prepare('SELECT created_at FROM creator_claims WHERE id=?').get(String(claim.id));
        upsertClaim.run(
          String(claim.id), briefId, String(claim.text), String(claim.claimType || 'fact'),
          String(claim.status || 'unresolved'), String(claim.confidence || 'unknown'),
          json(Array.isArray(claim.supportingSourceIds) ? claim.supportingSourceIds : [], []),
          String(claim.caveat || ''), json(claim, {}), old?.created_at || timestamp, timestamp
        );
      }
      if (incomingClaimIds.length) {
        const placeholders = incomingClaimIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM creator_claims WHERE brief_id=? AND id NOT IN (${placeholders})`).run(briefId, ...incomingClaimIds);
      } else {
        db.prepare('DELETE FROM creator_claims WHERE brief_id=?').run(briefId);
      }

      const persisted = getBundle(briefId);
      const hash = receiptHash(persisted);
      db.prepare('INSERT INTO audit_receipts(brief_id, operation, receipt_hash, payload_json, created_at) VALUES(?, ?, ?, ?, ?)')
        .run(briefId, 'save-bundle', hash, json({ briefId, sourceIds: incomingSourceIds, claimIds: incomingClaimIds }, {}), timestamp);
      db.exec('COMMIT');
      return { ...persisted, receipt: { schema: 'creator-data-receipt/v1', briefId, operation: 'save-bundle', hash, createdAt: timestamp } };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function mapBrief(row) {
    if (!row) return null;
    const payload = parseJson(row.payload_json, {});
    return {
      ...payload,
      id: row.id, topic: row.topic, status: row.status, mode: row.mode,
      trigger: row.trigger_text, audience: row.audience,
      teachingOutcome: row.teaching_outcome, creatorTake: row.creator_take,
      platforms: parseJson(row.platforms_json, []),
      artifactPlan: parseJson(row.artifact_plan_json, null),
      warnings: parseJson(row.warnings_json, []),
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  function mapSource(row) {
    const payload = parseJson(row.payload_json, {});
    return {
      ...payload,
      id: row.id, briefId: row.brief_id, url: row.url, canonicalUrl: row.canonical_url,
      evidenceClass: row.evidence_class, title: row.title, publisher: row.publisher,
      publishedAt: row.published_at, capturedAt: row.captured_at, snapshotHash: row.snapshot_hash,
      userNote: row.user_note, resolutionStatus: row.resolution_status,
      sourceLocator: parseJson(row.source_locator_json, null),
    };
  }

  function mapClaim(row) {
    const payload = parseJson(row.payload_json, {});
    return {
      ...payload,
      id: row.id, briefId: row.brief_id, text: row.claim_text, claimType: row.claim_type,
      status: row.status, confidence: row.confidence,
      supportingSourceIds: parseJson(row.supporting_source_ids_json, []), caveat: row.caveat,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  function getBundle(id) {
    const brief = mapBrief(db.prepare('SELECT * FROM creator_content_briefs WHERE id=?').get(String(id)));
    if (!brief) return null;
    const sources = db.prepare('SELECT * FROM creator_sources WHERE brief_id=? ORDER BY captured_at ASC, id ASC').all(String(id)).map(mapSource);
    const claims = db.prepare('SELECT * FROM creator_claims WHERE brief_id=? ORDER BY created_at ASC, id ASC').all(String(id)).map(mapClaim);
    return { schema: 'creator-content-bundle/v1', brief, sources, claims };
  }

  function listBriefs(limit = 50) {
    const bounded = Math.max(1, Math.min(200, Number(limit) || 50));
    return db.prepare('SELECT * FROM creator_content_briefs ORDER BY updated_at DESC LIMIT ?').all(bounded).map(mapBrief);
  }

  function latestReceipt(briefId) {
    const row = db.prepare('SELECT * FROM audit_receipts WHERE brief_id=? ORDER BY id DESC LIMIT 1').get(String(briefId));
    if (!row) return null;
    return { schema: 'creator-data-receipt/v1', briefId: row.brief_id, operation: row.operation, hash: row.receipt_hash, createdAt: row.created_at };
  }

  function health() {
    const schemaVersion = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get()?.version || 0;
    const briefCount = db.prepare('SELECT COUNT(*) AS count FROM creator_content_briefs').get()?.count || 0;
    return { ok: true, provider: 'creator-sqlite', schemaVersion, dbPath, briefCount };
  }

  function close() { db.close(); }

  return { dbPath, saveBundle, getBundle, listBriefs, latestReceipt, health, close };
}

module.exports = { createCreatorStore, receiptHash, canonical };
