import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const PatchInput = z.object({
  status: z.enum(['IDEA', 'SCRIPTED', 'RENDERING', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional(),
  hook: z.string().optional(),
  script: z.string().optional(),
  caption: z.string().optional(),
  videoUrl: z.string().url().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const content = await db.contentItem.findFirst({
      where: { id, channel: { workspaceId: workspace.id } },
      include: { channel: true, publications: true },
    });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    return Response.json({ ok: true, content });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load content';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const payload = PatchInput.parse(await request.json());
    const existing = await db.contentItem.findFirst({ where: { id, channel: { workspaceId: workspace.id } } });
    if (!existing) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });

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
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to update content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
