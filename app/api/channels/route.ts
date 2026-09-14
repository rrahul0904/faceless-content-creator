import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const ChannelInput = z.object({
  name: z.string().min(1),
  niche: z.string().min(1),
  handle: z.string().optional(),
  voice: z.string().optional(),
  templateId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const channels = await db.channel.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ ok: true, workspaceId: workspace.id, channels });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load channels';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = ChannelInput.parse(await request.json());
    const channel = await db.channel.create({ data: { ...payload, workspaceId: workspace.id } });
    return Response.json({ ok: true, channel }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create channel';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
