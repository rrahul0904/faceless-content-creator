import { z } from 'zod';

const env = z.object({
  ORSHOT_API_KEY: z.string().min(1),
  ORSHOT_TEMPLATE_ID: z.coerce.number().int().positive(),
  ORSHOT_BASE_URL: z.string().url().default('https://api.orshot.com'),
}).parse({
  ORSHOT_API_KEY: process.env.ORSHOT_API_KEY,
  ORSHOT_TEMPLATE_ID: process.env.ORSHOT_TEMPLATE_ID,
  ORSHOT_BASE_URL: process.env.ORSHOT_BASE_URL ?? 'https://api.orshot.com',
});

async function orshot<T>(path: string, init: RequestInit): Promise<T> {
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

export type RenderInput = {
  hook: string;
  script: string;
  topic: string;
  statNumber?: string;
  statLabel?: string;
  handle?: string;
  clipUrl?: string;
};

export type RenderJob = {
  id: number;
  status: string;
  finished: boolean;
  self?: string;
  created_at?: string;
};

export async function startRender(input: RenderInput) {
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
    }),
  });
}

export async function getRenderJob(id: number) {
  return orshot<Record<string, unknown>>(`/v1/studio/render-jobs/${id}`, { method: 'GET' });
}

export async function publishVideo(args: {
  videoUrl: string;
  caption: string;
  accountIds: number[];
  scheduledFor?: string;
  timezone?: string;
}) {
  return orshot<Record<string, unknown>>('/v1/social/publish', {
    method: 'POST',
    body: JSON.stringify({
      accounts: args.accountIds,
      content: args.caption,
      media_url: args.videoUrl,
      ...(args.scheduledFor
        ? {
            status: 'scheduled',
            scheduled_for: args.scheduledFor,
            timezone: args.timezone ?? 'America/New_York',
          }
        : { status: 'published' }),
    }),
  });
}
