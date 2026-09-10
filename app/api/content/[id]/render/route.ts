import { z } from 'zod';
import { db } from '@/lib/db';
import { createLocalRenderJob, type LocalTemplate } from '@/lib/render-queue';

export const runtime = 'nodejs';

const Input = z.object({
  voice: z.enum(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']).optional(),
  speechRate: z.number().int().min(110).max(230).optional(),
  template: z.enum(['editorial', 'signal', 'ember']).optional(),
});

function localTemplate(value: string | null | undefined): LocalTemplate {
  return value === 'signal' || value === 'ember' ? value : 'editorial';
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = Input.parse(await request.json().catch(() => ({})));
    const content = await db.contentItem.findUnique({ where: { id }, include: { channel: true } });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.hook || !content.script) {
      return Response.json({ ok: false, error: 'Content must have a hook and script before rendering' }, { status: 409 });
    }

    const template = input.template ?? localTemplate(content.channel.templateId);
    const job = await createLocalRenderJob({
      topic: content.topic,
      hook: content.hook,
      script: content.script,
      caption: content.caption ?? undefined,
      voice: input.voice ?? content.channel.voice ?? 'en-us',
      speechRate: input.speechRate ?? 165,
      template,
    }, content.id);

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status.toLowerCase(),
        finished: false,
        engine: 'local-ffmpeg',
        template,
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render content locally';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
