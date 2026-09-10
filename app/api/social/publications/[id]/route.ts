import { z } from 'zod';
import { db } from '@/lib/db';
import { startPublishWorker } from '@/lib/publish-worker';

const Action = z.object({ action: z.literal('retry') });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const publication = await db.publication.findUnique({
    where: { id },
    include: { content: { select: { id: true, topic: true, hook: true, videoUrl: true, status: true } } },
  });
  if (!publication) return Response.json({ ok: false, error: 'Publication not found' }, { status: 404 });
  return Response.json({ ok: true, publication });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    Action.parse(await request.json());
    const publication = await db.publication.findUnique({ where: { id } });
    if (!publication) return Response.json({ ok: false, error: 'Publication not found' }, { status: 404 });
    if (!['FAILED', 'SCHEDULED'].includes(publication.status)) {
      return Response.json({ ok: false, error: `Publication cannot be retried from ${publication.status}` }, { status: 409 });
    }
    await db.publication.update({ where: { id }, data: { status: 'QUEUED', scheduledFor: null, lastError: null } });
    startPublishWorker(id);
    return Response.json({ ok: true, id, status: 'queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to retry publication';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
