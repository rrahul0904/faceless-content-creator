'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function resolveDbPath(options = {}) {
  return options.dbPath || process.env.CREATOR_DATA_DB || path.join(process.env.CREATOR_DATA_DIR || path.join(process.cwd(), 'data'), 'creator.sqlite');
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function checkIntegrity(options = {}) {
  const dbPath = resolveDbPath(options);
  if (!fs.existsSync(dbPath)) {
    return { schema: 'creator-data-integrity/v1', ok: false, dbPath, error: 'DATABASE_NOT_FOUND' };
  }
  const db = new DatabaseSync(dbPath, { readOnly: true, enableForeignKeyConstraints: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    const integrityOk = integrity.length === 1 && String(integrity[0].integrity_check || '') === 'ok';
    const ok = integrityOk && foreignKeys.length === 0;
    return {
      schema: 'creator-data-integrity/v1',
      ok,
      dbPath,
      bytes: fs.statSync(dbPath).size,
      integrity,
      foreignKeyViolations: foreignKeys,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    db.close();
  }
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createBackup(options = {}) {
  const dbPath = resolveDbPath(options);
  const preflight = checkIntegrity({ dbPath });
  if (!preflight.ok) {
    const error = new Error(`Refusing backup because source integrity check failed: ${preflight.error || 'integrity failure'}`);
    error.code = 'SOURCE_INTEGRITY_FAILED';
    error.details = preflight;
    throw error;
  }
  const backupDir = options.backupDir || process.env.CREATOR_DATA_BACKUP_DIR || path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = options.backupPath || path.join(backupDir, `creator-${stamp}.sqlite`);
  if (fs.existsSync(backupPath)) throw Object.assign(new Error('Backup target already exists'), { code: 'BACKUP_TARGET_EXISTS' });

  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
  try {
    db.exec(`VACUUM INTO ${sqlLiteral(backupPath)}`);
  } finally {
    db.close();
  }

  const verification = checkIntegrity({ dbPath: backupPath });
  if (!verification.ok) {
    try { fs.rmSync(backupPath, { force: true }); } catch {}
    const error = new Error('Backup was created but failed integrity verification');
    error.code = 'BACKUP_INTEGRITY_FAILED';
    error.details = verification;
    throw error;
  }
  return {
    schema: 'creator-data-backup-receipt/v1',
    ok: true,
    sourcePath: dbPath,
    backupPath,
    bytes: verification.bytes,
    sha256: sha256File(backupPath),
    createdAt: new Date().toISOString(),
  };
}

module.exports = { resolveDbPath, checkIntegrity, createBackup, sha256File };
