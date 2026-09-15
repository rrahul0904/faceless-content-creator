import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const url = new URL(request.url);
    const templateId = url.searchParams.get('templateId') || undefined;
    const takeRaw = Number.parseInt(url.searchParams.get('limit') || '50', 10);
    const take = Math.max(1, Math.min(Number.isFinite(takeRaw) ? takeRaw : 50, 100));

    const jobs = await db.renderJob.findMany({
      where: { workspaceId: workspace.id, ...(templateId ? { templateId } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
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

    return Response.json({
      ok: true,
      data: jobs.map((job) => ({
        ...job,
        status: job.status.toLowerCase(),
        cancellable: job.status === 'QUEUED' || job.status === 'RUNNING',
      })),
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to list render jobs';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
