import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const templateId = url.searchParams.get('templateId') || undefined;
  const takeRaw = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const take = Math.max(1, Math.min(Number.isFinite(takeRaw) ? takeRaw : 50, 100));

  const jobs = await db.renderJob.findMany({
    where: templateId ? { templateId } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      templateId: true,
      status: true,
      videoUrl: true,
      error: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  return Response.json({
    ok: true,
    data: jobs.map((job) => ({ ...job, status: job.status.toLowerCase() })),
  });
}
