import { z } from 'zod';
import { db } from '@/lib/db';
import { startRender } from '@/lib/orshot';

const Input = z.object({ clipUrl: z.string().url().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { clipUrl } = Input.parse(await request.json().catch(() => ({})));
    const content = await db.contentItem.findUnique({ where: { id }, include: { channel: true } });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.hook || !content.script) {
      return Response.json({ ok: false, error: 'Content must have a hook and script before rendering' }, { status: 409 });
    }

    const job = await startRender({
      topic: content.topic,
      hook: content.hook,
      script: content.script,
      statNumber: content.statNumber ?? undefined,
      statLabel: content.statLabel ?? undefined,
      handle: content.channel.handle ?? undefined,
      clipUrl,
      metadata: content.id,
    });

    await db.contentItem.update({
      where: { id },
      data: { status: 'RENDERING', renderJobId: job.id },
    });

    return Response.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
