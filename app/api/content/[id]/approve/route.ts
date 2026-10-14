import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const content = await db.contentItem.findFirst({
      where: { id, channel: { workspaceId: workspace.id } },
    });

    if (!content) {
      return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    }
    if (content.status === 'APPROVED') {
      return Response.json({ ok: true, workspaceId: workspace.id, content, alreadyApproved: true });
    }
    if (content.status !== 'REVIEW') {
      return Response.json({
        ok: false,
        error: 'Content must be in review before approval',
        status: content.status.toLowerCase(),
      }, { status: 409 });
    }
    if (!content.videoUrl) {
      return Response.json({ ok: false, error: 'Content must have a rendered video before approval' }, { status: 409 });
    }

    const approved = await db.contentItem.update({
      where: { id: content.id },
      data: { status: 'APPROVED' },
    });

    return Response.json({ ok: true, workspaceId: workspace.id, content: approved, alreadyApproved: false });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to approve content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
