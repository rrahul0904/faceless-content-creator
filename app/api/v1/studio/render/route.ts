import { z } from 'zod';
import { queueTemplateRender } from '@/lib/template-engine/render';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  templateId: z.string().min(1),
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

export async function POST(request: Request) {
  try {
    const payload = RequestSchema.parse(await request.json());
    const queued = await queueTemplateRender(payload.templateId, payload);
    if (!queued) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });

    return Response.json({
      ok: true,
      data: {
        id: queued.job.id,
        jobId: queued.job.id,
        status: queued.job.status.toLowerCase(),
        mode: 'async',
        warnings: queued.warnings,
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to queue render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
