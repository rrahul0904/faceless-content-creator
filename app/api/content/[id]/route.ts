import { z } from 'zod';
import { db } from '@/lib/db';

const PatchInput = z.object({
  status: z.enum(['IDEA', 'SCRIPTED', 'RENDERING', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional(),
  hook: z.string().optional(),
  script: z.string().optional(),
  caption: z.string().optional(),
  videoUrl: z.string().url().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const content = await db.contentItem.findUnique({
    where: { id },
    include: { channel: true, publications: true },
  });
  if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
  return Response.json({ ok: true, content });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = PatchInput.parse(await request.json());
    const content = await db.contentItem.update({
      where: { id },
      data: {
        ...payload,
        ...(payload.scheduledFor !== undefined
          ? { scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null }
          : {}),
      },
    });
    return Response.json({ ok: true, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
