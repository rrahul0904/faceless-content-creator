import { z } from 'zod';
import { db } from '@/lib/db';

const Query = z.object({
  platform: z.string().optional(),
  accountId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = Query.parse({
      platform: url.searchParams.get('platform') ?? undefined,
      accountId: url.searchParams.get('accountId') ?? undefined,
    });

    const publications = await db.publication.findMany({
      where: {
        ...(parsed.platform ? { platform: parsed.platform } : {}),
        ...(parsed.accountId ? { accountId: parsed.accountId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { content: { select: { topic: true, hook: true, publishedAt: true } } },
    });

    const totals = publications.reduce((acc, item) => ({
      views: acc.views + (item.views ?? 0),
      likes: acc.likes + (item.likes ?? 0),
      comments: acc.comments + (item.comments ?? 0),
      shares: acc.shares + (item.shares ?? 0),
      saves: acc.saves + (item.saves ?? 0),
      watchTimeMs: acc.watchTimeMs + (item.watchTimeMs ?? 0),
    }), { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, watchTimeMs: 0 });

    const ranked = [...publications]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        platform: item.platform,
        status: item.status,
        topic: item.content.topic,
        hook: item.content.hook,
        views: item.views ?? 0,
        likes: item.likes ?? 0,
        comments: item.comments ?? 0,
        shares: item.shares ?? 0,
        saves: item.saves ?? 0,
      }));

    return Response.json({
      ok: true,
      data: {
        publicationCount: publications.length,
        totals,
        topPublications: ranked,
        source: 'local-sqlite',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load analytics';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
