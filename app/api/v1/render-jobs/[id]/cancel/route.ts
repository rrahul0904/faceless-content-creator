import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const job = await db.renderJob.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!job) return Response.json({ ok: false, error: 'Render job not found' }, { status: 404 });

    if (job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return Response.json({
        ok: true,
        data: {
          id: job.id,
          status: job.status.toLowerCase(),
          cancelRequested: job.cancelRequested,
          accepted: false,
          reason: 'already_finished',
        },
      });
    }

    const cancelledQueued = await db.renderJob.updateMany({
      where: { id, workspaceId: workspace.id, status: 'QUEUED', cancelRequested: false },
      data: { status: 'CANCELLED', cancelRequested: true, finishedAt: new Date() },
    });

    if (cancelledQueued.count === 1) {
      const content = await db.contentItem.findFirst({ where: { renderJobId: id } });
      if (content) {
        await db.contentItem.update({ where: { id: content.id }, data: { status: 'SCRIPTED' } });
      }
      return Response.json({
        ok: true,
        data: { id, status: 'cancelled', cancelRequested: true, accepted: true, mode: 'immediate' },
      });
    }

    const requested = await db.renderJob.updateMany({
      where: { id, workspaceId: workspace.id, status: 'RUNNING' },
      data: { cancelRequested: true },
    });

    if (requested.count === 1) {
      return Response.json({
        ok: true,
        data: { id, status: 'running', cancelRequested: true, accepted: true, mode: 'cooperative' },
      }, { status: 202 });
    }

    const current = await db.renderJob.findFirst({ where: { id, workspaceId: workspace.id } });
    return Response.json({
      ok: true,
      data: {
        id,
        status: current?.status.toLowerCase() ?? 'unknown',
        cancelRequested: current?.cancelRequested ?? false,
        accepted: false,
        reason: 'state_changed',
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to cancel render job';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
