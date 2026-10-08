-- Creator Data Service hosted Postgres schema.
-- This schema is intentionally private: Creator Console talks only to the
-- Creator Data HTTP API, never directly to PostgREST/Data API tables.

create schema if not exists creator_private;

revoke all on schema creator_private from public;
revoke all on schema creator_private from anon;
revoke all on schema creator_private from authenticated;

create table if not exists creator_private.service_credentials (
  name text primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists creator_private.content_briefs (
  id text primary key,
  brief jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_private.profile (
  id text primary key check (id = 'default'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists creator_private.research_items (
  id text primary key,
  source_url text not null unique,
  payload jsonb not null,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_private.drafts (
  run_id text not null,
  platform text not null,
  version integer not null check (version >= 1),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, platform, version)
);

create table if not exists creator_private.publications (
  id bigint generated always as identity primary key,
  run_id text not null,
  platform text not null,
  draft_hash text not null,
  payload jsonb not null,
  published_at timestamptz not null default now()
);

create table if not exists creator_private.audit_receipts (
  id bigint generated always as identity primary key,
  brief_id text not null,
  operation text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists content_briefs_updated_idx
  on creator_private.content_briefs (updated_at desc);
create index if not exists research_items_sort_idx
  on creator_private.research_items (published_at desc nulls last, discovered_at desc);
create index if not exists drafts_created_idx
  on creator_private.drafts (created_at desc);
create index if not exists publications_published_idx
  on creator_private.publications (published_at desc);
create index if not exists audit_receipts_brief_idx
  on creator_private.audit_receipts (brief_id, created_at desc);

revoke all on all tables in schema creator_private from public;
revoke all on all tables in schema creator_private from anon;
revoke all on all tables in schema creator_private from authenticated;

alter default privileges in schema creator_private revoke all on tables from public;
alter default privileges in schema creator_private revoke all on tables from anon;
alter default privileges in schema creator_private revoke all on tables from authenticated;
