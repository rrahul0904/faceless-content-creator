import { z } from 'zod';
import { db } from '@/lib/db';

const RenderWebhook = z.object({
  event: z.literal('render_job.finished'),
  job: z.object({
    id: z.number().int().positive(),
    status: z.string(),
    finished: z.boolean(),
    metadata: z.string().optional(),
    result: z.object({
      data: z.object({ content: z.string().url().optional() }).passthrough().optional(),
    }).passthrough().optional(),
    error: z.unknown().optional(),
  }).passthrough(),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.WEBHOOK_SECRET;
  const supplied = url.searchParams.get('secret');
  if (!expected || supplied !== expected) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = RenderWebhook.parse(await request.json());
    const contentId = payload.job.metadata;
    const videoUrl = payload.job.result?.data?.content;

    if (contentId) {
      await db.contentItem.updateMany({
        where: { id: contentId },
        data: payload.job.status === 'succeeded'
          ? { status: 'REVIEW', renderJobId: payload.job.id, ...(videoUrl ? { videoUrl } : {}) }
          : { status: 'FAILED', renderJobId: payload.job.id },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
