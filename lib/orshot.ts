import { z } from 'zod';

const OrshotEnv = z.object({
  ORSHOT_API_KEY: z.string().min(1),
  ORSHOT_TEMPLATE_ID: z.coerce.number().int().positive(),
  ORSHOT_BASE_URL: z.string().url().default('https://api.orshot.com'),
});

function getEnv() {
  return OrshotEnv.parse({
    ORSHOT_API_KEY: process.env.ORSHOT_API_KEY,
    ORSHOT_TEMPLATE_ID: process.env.ORSHOT_TEMPLATE_ID,
    ORSHOT_BASE_URL: process.env.ORSHOT_BASE_URL ?? 'https://api.orshot.com',
  });
}

async function orshot<T>(path: string, init: RequestInit): Promise<T> {
  const env = getEnv();
  const res = await fetch(`${env.ORSHOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ORSHOT_API_KEY}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Orshot ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type SocialAccount = {
  id: number;
  platform: string;
  account_name?: string;
  account_username?: string;
  account_avatar?: string;
  requires_reconnect?: boolean;
};

export async function listSocialAccounts(includeHealth = true) {
  return orshot<{ data: SocialAccount[] }>(`/v1/social/accounts${includeHealth ? '?include_health=true' : ''}`, { method: 'GET' });
}

export type PresenterInput = {
  imageRef: string;
  script: string;
  voice: string;
  aspect?: string;
};

export async function createPresenter(input: PresenterInput) {
  return orshot<{ url: string; [key: string]: unknown }>('/v1/ai/video', {
    method: 'POST',
    body: JSON.stringify({
      imageRef: input.imageRef,
      script: input.script,
      voice: input.voice,
      consent: true,
      aspect: input.aspect ?? '9:16',
      sync: true,
    }),
  });
}

export type RenderInput = {
  hook: string;
  script: string;
  topic: string;
  statNumber?: string;
  statLabel?: string;
  handle?: string;
  clipUrl?: string;
  metadata?: string;
};

export type RenderJob = {
  id: number;
  status: string;
  finished: boolean;
  self?: string;
  created_at?: string;
  result?: { data?: { content?: string } };
  error?: unknown;
  metadata?: string;
};

export async function startRender(input: RenderInput) {
  const env = getEnv();
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const webhookUrl = appBaseUrl && webhookSecret && !appBaseUrl.includes('localhost')
    ? `${appBaseUrl}/api/webhooks/orshot?secret=${encodeURIComponent(webhookSecret)}`
    : undefined;

  return orshot<RenderJob>('/v1/studio/render', {
    method: 'POST',
    body: JSON.stringify({
      templateId: env.ORSHOT_TEMPLATE_ID,
      response: { mode: 'async', type: 'url', format: 'mp4' },
      modifications: {
        hook: input.hook,
        topic: input.topic,
        script: input.script,
        stat_number: input.statNumber ?? '',
        stat_label: input.statLabel ?? '',
        handle: input.handle ?? '@faceless',
        ...(input.clipUrl ? { clip: input.clipUrl } : {}),
      },
      ...(input.clipUrl
        ? { videoOptions: { fps: 30, subtitleSource: [{ page: 1, url: input.clipUrl }] } }
        : { videoOptions: { fps: 30 } }),
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }),
  });
}

export async function getRenderJob(id: number) {
  return orshot<RenderJob>(`/v1/studio/render-jobs/${id}`, { method: 'GET' });
}

export async function publishVideo(args: {
  videoUrl: string;
  caption: string;
  accountIds: number[];
  scheduledFor?: string;
  timezone?: string;
  draft?: boolean;
}) {
  return orshot<Record<string, unknown>>('/v1/social/publish', {
    method: 'POST',
    body: JSON.stringify({
      accounts: args.accountIds,
      content: args.caption,
      media_url: args.videoUrl,
      ...(args.draft
        ? { status: 'draft' }
        : args.scheduledFor
          ? {
              status: 'scheduled',
              scheduled_for: args.scheduledFor,
              timezone: args.timezone ?? 'America/New_York',
            }
          : { status: 'published' }),
    }),
  });
}

export type AnalyticsQuery = {
  platform?: string;
  accountId?: number;
  source?: 'all' | 'orshot' | 'external';
  from?: string;
  to?: string;
  refresh?: boolean;
};

function analyticsQueryString(query: AnalyticsQuery) {
  const params = new URLSearchParams();
  if (query.platform) params.set('platform', query.platform);
  if (query.accountId) params.set('account_id', String(query.accountId));
  if (query.source) params.set('source', query.source);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.refresh) params.set('refresh', '1');
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function getSocialAnalytics(query: AnalyticsQuery = {}) {
  return orshot<Record<string, unknown>>(`/v1/social/analytics${analyticsQueryString(query)}`, { method: 'GET' });
}

export async function getSocialInsights(query: Omit<AnalyticsQuery, 'from' | 'to'> = {}) {
  return orshot<Record<string, unknown>>(`/v1/social/analytics/insights${analyticsQueryString(query)}`, { method: 'GET' });
}
