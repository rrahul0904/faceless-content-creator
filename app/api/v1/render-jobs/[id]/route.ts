import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await db.renderJob.findUnique({
    where: { id },
    select: {
      id: true,
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
}
