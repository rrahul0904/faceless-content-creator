import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const job = await db.renderJob.findFirst({
      where: { id, workspaceId: workspace.id },
      select: {
        id: true,
        workspaceId: true,
        templateId: true,
        status: true,
        cancelRequested: true,
        videoUrl: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!job) return Response.json({ ok: false, error: 'Render job not found' }, { status: 404 });

    const finished = job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELLED';
    return Response.json({
      ok: true,
      data: {
        ...job,
        status: job.status.toLowerCase(),
        finished,
        cancellable: !finished,
        result: job.status === 'SUCCEEDED' && job.videoUrl ? { url: job.videoUrl, format: 'mp4' } : null,
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load render job';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
