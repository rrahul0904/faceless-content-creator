import { z } from 'zod';
import { getSocialAnalytics, getSocialInsights } from '@/lib/orshot';

const Query = z.object({
  view: z.enum(['overview', 'insights']).default('overview'),
  platform: z.string().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  source: z.enum(['all', 'orshot', 'external']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  refresh: z.enum(['0', '1']).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = Query.parse({
      view: url.searchParams.get('view') ?? 'overview',
      platform: url.searchParams.get('platform') ?? undefined,
      accountId: url.searchParams.get('accountId') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      refresh: url.searchParams.get('refresh') ?? undefined,
    });

    const common = {
      platform: parsed.platform,
      accountId: parsed.accountId,
      source: parsed.source,
      refresh: parsed.refresh === '1',
    };

    const data = parsed.view === 'insights'
      ? await getSocialInsights(common)
      : await getSocialAnalytics({ ...common, from: parsed.from, to: parsed.to });

    return Response.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load analytics';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
