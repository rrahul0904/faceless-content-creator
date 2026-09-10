import { z } from 'zod';
import { createLocalRenderJob } from '@/lib/render-queue';

export const runtime = 'nodejs';

const RenderRequest = z.object({
  hook: z.string().min(1).max(280),
  script: z.string().min(1).max(6000),
  topic: z.string().min(1).max(500),
  caption: z.string().max(2200).optional(),
  voice: z.enum(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']).default('en-us'),
  speechRate: z.number().int().min(110).max(230).default(165),
  template: z.enum(['editorial', 'signal', 'ember']).default('editorial'),
  contentId: z.string().cuid().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = RenderRequest.parse(await request.json());
    const job = await createLocalRenderJob(payload, payload.contentId);

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status.toLowerCase(),
        finished: false,
        engine: 'local-ffmpeg',
        template: payload.template,
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start local render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
