create extension if not exists pgcrypto;

create table if not exists public.creator_profiles (
  id text primary key default 'default',
  identity jsonb not null default '{}'::jsonb,
  voice jsonb not null default '{}'::jsonb,
  expertise jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_research_items (
  id text primary key,
  source_url text not null unique,
  vendor text,
  topic text not null,
  published_at date,
  status text not null,
  payload jsonb not null,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_content_briefs (
  id text primary key,
  topic text not null,
  status text not null,
  mode text not null default 'factual-explainer',
  trigger text not null default '',
  audience text not null default '',
  teaching_outcome text not null default '',
  creator_take text not null default '',
  platforms jsonb not null default '[]'::jsonb,
  artifact_plan jsonb,
  warnings jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_sources (
  id text primary key,
  brief_id text not null references public.creator_content_briefs(id) on delete cascade,
  url text not null,
  canonical_url text not null,
  evidence_class text not null,
  title text not null default '',
  publisher text not null default '',
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  snapshot_hash text,
  user_note text not null default '',
  resolution_status text not null default 'resolved',
  payload jsonb not null,
  unique(brief_id, canonical_url)
);

create table if not exists public.creator_claims (
  id text primary key,
  brief_id text not null references public.creator_content_briefs(id) on delete cascade,
  claim_text text not null,
  claim_type text not null,
  status text not null,
  confidence text not null default 'unknown',
  supporting_source_ids jsonb not null default '[]'::jsonb,
  caveat text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_drafts (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  platform text not null check (platform in ('linkedin','medium')),
  topic text not null,
  content text not null,
  status text not null default 'draft',
  version integer not null default 1 check (version > 0),
  run_receipt jsonb,
  approval_receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, platform, version)
);

create table if not exists public.creator_publications (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  platform text not null,
  external_id text,
  draft_hash text not null,
  publication_receipt jsonb not null,
  published_at timestamptz not null default now()
);

alter table public.creator_profiles enable row level security;
alter table public.creator_research_items enable row level security;
alter table public.creator_content_briefs enable row level security;
alter table public.creator_sources enable row level security;
alter table public.creator_claims enable row level security;
alter table public.creator_drafts enable row level security;
alter table public.creator_publications enable row level security;

revoke all on public.creator_profiles from anon, authenticated;
revoke all on public.creator_research_items from anon, authenticated;
revoke all on public.creator_content_briefs from anon, authenticated;
revoke all on public.creator_sources from anon, authenticated;
revoke all on public.creator_claims from anon, authenticated;
revoke all on public.creator_drafts from anon, authenticated;
revoke all on public.creator_publications from anon, authenticated;

grant all on public.creator_profiles to service_role;
grant all on public.creator_research_items to service_role;
grant all on public.creator_content_briefs to service_role;
grant all on public.creator_sources to service_role;
grant all on public.creator_claims to service_role;
grant all on public.creator_drafts to service_role;
grant all on public.creator_publications to service_role;

create index if not exists creator_research_items_published_idx on public.creator_research_items(published_at desc nulls last);
create index if not exists creator_content_briefs_updated_idx on public.creator_content_briefs(updated_at desc);
create index if not exists creator_sources_brief_idx on public.creator_sources(brief_id, captured_at desc);
create index if not exists creator_claims_brief_idx on public.creator_claims(brief_id, updated_at desc);
create index if not exists creator_drafts_created_idx on public.creator_drafts(created_at desc);
create index if not exists creator_publications_published_idx on public.creator_publications(published_at desc);
