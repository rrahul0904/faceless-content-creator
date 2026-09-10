CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  niche text NOT NULL,
  handle text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  auto_publish boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_items (
  id text PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  niche text NOT NULL,
  topic text NOT NULL,
  hook text NOT NULL,
  script text NOT NULL,
  caption text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  render_job_id text UNIQUE,
  render_status text NOT NULL DEFAULT 'draft',
  media_url text,
  auto_publish boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_items_render_queue_idx ON content_items (render_status, created_at) WHERE render_status IN ('queued','processing');

CREATE TABLE IF NOT EXISTS social_posts (
  id bigserial PRIMARY KEY,
  content_item_id text REFERENCES content_items(id) ON DELETE SET NULL,
  provider_post_id text,
  platform text NOT NULL,
  account_id text,
  status text NOT NULL,
  post_url text,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id bigserial PRIMARY KEY,
  social_post_id bigint REFERENCES social_posts(id) ON DELETE CASCADE,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  engagement_rate numeric(8,4) NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
