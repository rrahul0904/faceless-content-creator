import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await db.renderJob.findUnique({ where: { id } });
    if (!job) {
      return Response.json({ ok: false, error: 'Render job not found' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status.toLowerCase(),
        finished: job.status === 'SUCCEEDED' || job.status === 'FAILED',
        result: job.videoUrl ? { data: { content: job.videoUrl } } : undefined,
        error: job.error ?? undefined,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString(),
        finished_at: job.finishedAt?.toISOString(),
        engine: 'local-ffmpeg',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load render job';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
