'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(path.join(root, 'creator-data-service', 'postgres', 'schema.sql'), 'utf8');
const edge = fs.readFileSync(path.join(root, 'supabase', 'functions', 'creator-data', 'index.ts'), 'utf8');

test('hosted Postgres schema stays behind a private Creator Data boundary', () => {
  assert.match(schema, /create schema if not exists creator_private/i);
  assert.match(schema, /revoke all on schema creator_private from public/i);
  assert.match(schema, /revoke all on schema creator_private from anon/i);
  assert.match(schema, /revoke all on schema creator_private from authenticated/i);
  assert.doesNotMatch(schema, /create table\s+(?:if not exists\s+)?public\./i);
  for (const table of ['service_credentials', 'content_briefs', 'profile', 'research_items', 'drafts', 'publications', 'audit_receipts']) {
    assert.match(schema, new RegExp(`creator_private\\.${table}`, 'i'));
  }
});

test('hosted adapter preserves the Creator Data HTTP contract', () => {
  for (const route of ['/health', '/v1/profile', '/v1/research', '/v1/drafts', '/v1/publications', '/v1/briefs']) {
    assert.ok(edge.includes(route), `missing route ${route}`);
  }
  assert.match(edge, /\/v1\\\/briefs\\\/\(\[\^\/\]\+\)/);
  assert.match(edge, /creator-data-api\/v1/);
  assert.match(edge, /service:\s*'creator-data-service'/);
  assert.match(edge, /provider:\s*'creator-postgres'/);
});

test('hosted adapter fails closed and proves runtime replacement', () => {
  assert.match(edge, /service_credentials/);
  assert.match(edge, /sha256Hex\(token\)/);
  assert.match(edge, /UNAUTHORIZED/);
  assert.match(edge, /DENO_DEPLOYMENT_ID/);
  assert.match(edge, /runtimeInstanceId/);
  assert.match(edge, /DUPLICATE_CANONICAL_SOURCE/);
  assert.match(edge, /UNKNOWN_SUPPORTING_SOURCE/);
});

test('hosted adapter keeps brief writes atomic and audited', () => {
  assert.match(edge, /sql\.begin/);
  assert.match(edge, /creator_private\.content_briefs/);
  assert.match(edge, /creator_private\.audit_receipts/);
  assert.match(edge, /creator-data-receipt\/v1/);
  assert.match(edge, /sourceLocator|sources/);
});
