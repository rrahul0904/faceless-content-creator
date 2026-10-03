import { db } from '@/lib/db';
import { generateSeriesEpisode } from '@/lib/series-runner';

function authorized(request: Request) {
  const configured = process.env.SERIES_CRON_SECRET;
  if (!configured) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-series-secret') === configured;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: 'Series processor is not authorized' }, { status: 401 });
  }

  const due = await db.series.findMany({
    where: { status: 'ACTIVE', nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: 'asc' },
    take: 10,
  });

  const results = [];
  for (const series of due) {
    try {
      const generated = await generateSeriesEpisode(series.id);
      results.push({ seriesId: series.id, ok: true, contentId: generated.content.id, nextRunAt: generated.nextRunAt });
    } catch (error) {
      results.push({ seriesId: series.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return Response.json({ ok: results.every((item) => item.ok), processed: results.length, results });
}
