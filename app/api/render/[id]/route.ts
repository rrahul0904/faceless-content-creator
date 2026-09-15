import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const job = await db.renderJob.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!job) {
      return Response.json({ ok: false, error: 'Render job not found' }, { status: 404 });
    }

    const finished = job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELLED';
    return Response.json({
      ok: true,
      job: {
        id: job.id,
        workspaceId: workspace.id,
        status: job.status.toLowerCase(),
        finished,
        cancellable: !finished,
        cancel_requested: job.cancelRequested,
        result: job.status === 'SUCCEEDED' && job.videoUrl ? { data: { content: job.videoUrl } } : undefined,
        error: job.error ?? undefined,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString(),
        finished_at: job.finishedAt?.toISOString(),
        engine: 'local-ffmpeg',
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load render job';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
