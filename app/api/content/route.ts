import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const ContentInput = z.object({
  channelId: z.string().min(1),
  topic: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  hook: z.string().optional(),
  script: z.string().optional(),
  caption: z.string().optional(),
  statNumber: z.string().optional(),
  statLabel: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId') ?? undefined;
    const contents = await db.contentItem.findMany({
      where: {
        channel: { workspaceId: workspace.id },
        ...(channelId ? { channelId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { publications: true },
      take: 100,
    });
    return Response.json({ ok: true, workspaceId: workspace.id, contents });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load content';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = ContentInput.parse(await request.json());
    const channel = await db.channel.findFirst({ where: { id: payload.channelId, workspaceId: workspace.id } });
    if (!channel) return Response.json({ ok: false, error: 'Channel not found' }, { status: 404 });

    const content = await db.contentItem.create({
      data: {
        ...payload,
        status: payload.script ? 'SCRIPTED' : 'IDEA',
      },
    });
    return Response.json({ ok: true, content }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
