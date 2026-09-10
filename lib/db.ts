import { Pool } from "pg";
import type { ContentIdea } from "./types";

let pool: Pool | null = null;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return pool;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function recordPipelineRun(args: { idea: ContentIdea; renderJobId: string; status: string; autoPublish: boolean; channelId?: string }) {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO content_items (id, channel_id, niche, topic, hook, script, caption, hashtags, score, render_job_id, render_status, auto_publish)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET render_job_id=EXCLUDED.render_job_id, render_status=EXCLUDED.render_status, updated_at=NOW()`,
    [args.idea.id, args.channelId ?? null, args.idea.niche, args.idea.topic, args.idea.hook, args.idea.script, args.idea.caption, args.idea.hashtags, args.idea.score, args.renderJobId, args.status, args.autoPublish]
  );
}

export async function updateRenderRecord(jobId: string, status: string, mediaUrl?: string, error?: string) {
  const db = getPool(); if (!db) return;
  await db.query(`UPDATE content_items SET render_status=$2, media_url=COALESCE($3, media_url), error=$4, updated_at=NOW() WHERE render_job_id=$1`, [jobId, status, mediaUrl ?? null, error ?? null]);
}

export async function pendingRenderJobs(limit = 25): Promise<string[]> {
  const db = getPool(); if (!db) return [];
  const result = await db.query(`SELECT render_job_id FROM content_items WHERE render_job_id IS NOT NULL AND render_status IN ('queued','processing') ORDER BY created_at ASC LIMIT $1`, [limit]);
  return result.rows.map((row) => String(row.render_job_id));
}

export type ChannelRecord = {
  id: string;
  name: string;
  niche: string;
  handle: string | null;
  timezone: string;
  autoPublish: boolean;
  createdAt: string;
};

export async function listChannels(): Promise<ChannelRecord[]> {
  const db = getPool(); if (!db) return [];
  const result = await db.query(`SELECT id, name, niche, handle, timezone, auto_publish, created_at FROM channels ORDER BY created_at DESC`);
  return result.rows.map((row) => ({
    id: String(row.id), name: String(row.name), niche: String(row.niche), handle: row.handle ? String(row.handle) : null,
    timezone: String(row.timezone), autoPublish: Boolean(row.auto_publish), createdAt: new Date(row.created_at).toISOString()
  }));
}

export async function createChannel(input: { name: string; niche: string; handle?: string; timezone?: string; autoPublish?: boolean }): Promise<ChannelRecord | null> {
  const db = getPool(); if (!db) return null;
  const result = await db.query(
    `INSERT INTO channels (name, niche, handle, timezone, auto_publish) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, niche, handle, timezone, auto_publish, created_at`,
    [input.name, input.niche, input.handle ?? null, input.timezone ?? "America/New_York", Boolean(input.autoPublish)]
  );
  const row = result.rows[0];
  return { id: String(row.id), name: String(row.name), niche: String(row.niche), handle: row.handle ? String(row.handle) : null, timezone: String(row.timezone), autoPublish: Boolean(row.auto_publish), createdAt: new Date(row.created_at).toISOString() };
}

export type ContentRecord = {
  id: string;
  channelId: string | null;
  topic: string;
  hook: string;
  score: number;
  renderStatus: string;
  mediaUrl: string | null;
  autoPublish: boolean;
  createdAt: string;
};

export async function listContentItems(limit = 50): Promise<ContentRecord[]> {
  const db = getPool(); if (!db) return [];
  const result = await db.query(
    `SELECT id, channel_id, topic, hook, score, render_status, media_url, auto_publish, created_at
     FROM content_items ORDER BY created_at DESC LIMIT $1`, [Math.max(1, Math.min(limit, 200))]
  );
  return result.rows.map((row) => ({
    id: String(row.id), channelId: row.channel_id ? String(row.channel_id) : null, topic: String(row.topic), hook: String(row.hook), score: Number(row.score),
    renderStatus: String(row.render_status), mediaUrl: row.media_url ? String(row.media_url) : null, autoPublish: Boolean(row.auto_publish), createdAt: new Date(row.created_at).toISOString()
  }));
}
