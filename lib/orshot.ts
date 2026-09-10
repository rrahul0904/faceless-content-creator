import { isDemoMode, requiredEnv } from "./config";
import type { ContentIdea, RenderJobStatus } from "./types";

type JsonObject = Record<string, unknown>;

async function orshot<T>(path: string, init?: RequestInit): Promise<T> {
  const key = requiredEnv("ORSHOT_API_KEY");
  const response = await fetch(`https://api.orshot.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) throw new Error(`Orshot ${path} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function createPresenterVideo(script: string): Promise<string> {
  if (isDemoMode()) return "mock://presenter/demo.mp4";
  const result = await orshot<{ url?: string; data?: { url?: string } }>("/ai/video", {
    method: "POST",
    body: JSON.stringify({ imageRef: requiredEnv("ORSHOT_PRESENTER_IMAGE_URL"), script, voice: requiredEnv("ORSHOT_VOICE_ID"), consent: true, aspect: "9:16", sync: true })
  });
  const url = result.url ?? result.data?.url;
  if (!url) throw new Error("Orshot presenter generation returned no URL");
  return url;
}

export async function startShortRender(args: { idea: ContentIdea; clipUrl?: string; autoPublish?: boolean; accountIds?: number[]; scheduledFor?: string; timezone?: string }) {
  if (isDemoMode()) return { id: `demo_${crypto.randomUUID()}`, status: "demo", raw: { demo: true } };
  const templateId = Number(requiredEnv("ORSHOT_TEMPLATE_ID"));
  if (!Number.isFinite(templateId)) throw new Error("ORSHOT_TEMPLATE_ID must be numeric");
  const modifications: JsonObject = { topic: args.idea.topic, hook: args.idea.hook, stat_number: args.idea.statNumber, stat_label: args.idea.statLabel, handle: process.env.ORSHOT_HANDLE ?? "@facelesscreator" };
  if (args.clipUrl) modifications.clip = args.clipUrl;
  const publish = args.autoPublish && args.accountIds?.length ? {
    accounts: args.accountIds,
    content: `${args.idea.caption}\n\n${args.idea.hashtags.join(" ")}`,
    ...(args.scheduledFor ? { schedule: { scheduledFor: args.scheduledFor }, timezone: args.timezone ?? "America/New_York" } : {})
  } : undefined;
  const payload: JsonObject = {
    templateId,
    response: { type: "url", format: "mp4", mode: "async" },
    modifications,
    videoOptions: { fps: 30, ...(args.clipUrl ? { subtitleSource: [{ page: 1, url: args.clipUrl }] } : {}) },
    ...(publish ? { publish } : {})
  };
  const job = await orshot<{ id: number | string; status: string }>("/studio/render", { method: "POST", body: JSON.stringify(payload) });
  return { id: String(job.id), status: job.status, raw: job };
}

export async function getRenderJob(id: string): Promise<RenderJobStatus> {
  if (id.startsWith("demo_") || isDemoMode()) return { id, status: "demo", finished: true, mediaUrl: "mock://render/faceless-short.mp4", raw: { demo: true } };
  const job = await orshot<any>(`/studio/render-jobs/${encodeURIComponent(id)}`);
  const rawStatus = String(job.status ?? "processing") as RenderJobStatus["status"];
  const mediaUrl = job.result?.data?.content ?? job.result?.data?.url ?? job.result?.url ?? job.url;
  return { id, status: rawStatus, finished: Boolean(job.finished ?? ["succeeded", "failed", "canceled"].includes(rawStatus)), mediaUrl: typeof mediaUrl === "string" ? mediaUrl : undefined, error: typeof job.error === "string" ? job.error : undefined, raw: job };
}

export async function publishMedia(args: { mediaUrl: string; content: string; accountIds: number[]; scheduledFor?: string; timezone?: string }) {
  if (isDemoMode()) return { id: `post_${crypto.randomUUID()}`, status: args.scheduledFor ? "scheduled" : "published", demo: true };
  return orshot<any>("/social/publish", { method: "POST", body: JSON.stringify({ accounts: args.accountIds, content: args.content, media_url: args.mediaUrl, ...(args.scheduledFor ? { status: "scheduled", scheduled_for: args.scheduledFor, timezone: args.timezone ?? "America/New_York" } : {}) }) });
}

export type SocialAccount = {
  id: number;
  platform: string;
  account_name: string;
  account_username: string;
  account_avatar?: string;
  connected_at?: string;
  requires_reconnect?: boolean;
};

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  if (isDemoMode()) return [
    { id: 1, platform: "youtube", account_name: "Faceless Creator", account_username: "facelesscreator" },
    { id: 2, platform: "instagram", account_name: "Faceless Creator", account_username: "facelesscreator" },
    { id: 3, platform: "tiktok", account_name: "Faceless Creator", account_username: "facelesscreator" }
  ];
  const result = await orshot<{ data?: SocialAccount[] }>("/social/accounts?include_health=true");
  return Array.isArray(result.data) ? result.data : [];
}

export async function getSocialAnalytics() {
  if (isDemoMode()) return { data: { analytics_available: true, overview: { total_posts: 32, published_posts: 29, scheduled_posts: 3 }, metrics: { views: 184200, likes: 12840, shares: 2240, saves: 3180, engagement_rate: 9.8 } } };
  return orshot<any>("/social/analytics?sort=engagement");
}

export async function getSocialInsights() {
  if (isDemoMode()) return { data: { best_time: [{ day_of_week: 2, hour: 19, score: 0.91 }] } };
  return orshot<any>("/social/analytics/insights");
}
