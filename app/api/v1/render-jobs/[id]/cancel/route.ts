import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await db.renderJob.findUnique({ where: { id } });
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

  // Claim queued jobs atomically so a worker cannot start them after cancellation.
  const cancelledQueued = await db.renderJob.updateMany({
    where: { id, status: 'QUEUED', cancelRequested: false },
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

  // Running renderers cooperate with this flag before persisting their result. The current
  // FFmpeg process may finish its in-flight operation, but a cancelled job can never become
  // SUCCEEDED afterwards.
  const requested = await db.renderJob.updateMany({
    where: { id, status: 'RUNNING' },
    data: { cancelRequested: true },
  });

  if (requested.count === 1) {
    return Response.json({
      ok: true,
      data: { id, status: 'running', cancelRequested: true, accepted: true, mode: 'cooperative' },
    }, { status: 202 });
  }

  const current = await db.renderJob.findUnique({ where: { id } });
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
}
