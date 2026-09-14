import { z } from 'zod';
import { queueTemplateRender } from '@/lib/template-engine/render';

export const runtime = 'nodejs';

const RenderRequest = z.object({
  modifications: z.record(z.string(), z.unknown()).default({}),
  response: z.object({
    format: z.literal('mp4').default('mp4'),
    mode: z.literal('async').default('async'),
    size: z.object({
      width: z.number().int().min(64).max(4096),
      height: z.number().int().min(64).max(4096),
    }).optional(),
  }).default({ format: 'mp4', mode: 'async' }),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = RenderRequest.parse(await request.json().catch(() => ({})));
    const queued = await queueTemplateRender(id, payload);
    if (!queued) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });

    return Response.json({
      ok: true,
      data: {
        jobId: queued.job.id,
        status: queued.job.status.toLowerCase(),
        mode: 'async',
        warnings: queued.warnings,
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to queue template render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
