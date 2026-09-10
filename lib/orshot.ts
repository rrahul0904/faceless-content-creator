import { z } from 'zod';

const env = z.object({
  ORSHOT_API_KEY: z.string().min(1),
  ORSHOT_TEMPLATE_ID: z.string().min(1),
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

export async function startRender(input: RenderInput) {
  return orshot<{ id?: string; jobId?: string; status?: string }>('/v1/studio/render', {
    method: 'POST',
    body: JSON.stringify({
      templateId: env.ORSHOT_TEMPLATE_ID,
      response: { mode: 'async' },
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

export async function publishVideo(args: { videoUrl: string; caption: string; socialAccountIds: string[]; scheduledAt?: string }) {
  return orshot('/v1/social/publish', {
    method: 'POST',
    body: JSON.stringify({
      mediaUrl: args.videoUrl,
      caption: args.caption,
      socialAccountIds: args.socialAccountIds,
      ...(args.scheduledAt ? { scheduledAt: args.scheduledAt } : {}),
    }),
  });
}
