import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { generateScript } from '@/lib/content';
import { discoverVisuals } from '@/lib/visuals';
import { nextSeriesRun } from '@/lib/series';

export async function generateSeriesEpisode(seriesId: string) {
  const series = await db.series.findUnique({
    where: { id: seriesId },
    include: { channel: true },
  });
  if (!series) throw new Error('Series not found');
  if (series.status !== 'ACTIVE') throw new Error('Series is paused');

  const now = new Date();
  const result = await generateScript({
    niche: series.channel.niche,
    idea: `${series.brief}\nCreate a fresh episode for ${now.toISOString().slice(0, 10)}. Avoid repeating the same hook or framing from prior episodes.`,
    audience: series.audience ?? undefined,
  });
  const visuals = await discoverVisuals(result.script).catch(() => []);
  const nextRunAt = nextSeriesRun({
    cadence: series.cadence,
    weekday: series.weekday,
    hour: series.hour,
    minute: series.minute,
    timezone: series.timezone,
    from: now,
  });

  const content = await db.$transaction(async (tx) => {
    const created = await tx.contentItem.create({
      data: {
        channelId: series.channelId,
        topic: result.topic,
        hook: result.hook,
        script: result.script,
        caption: result.caption,
        statNumber: result.statNumber,
        statLabel: result.statLabel,
        visuals: visuals as unknown as Prisma.InputJsonValue,
        sourceUrl: `series:${series.id}`,
        status: 'SCRIPTED',
      },
    });
    await tx.series.update({
      where: { id: series.id },
      data: { lastRunAt: now, nextRunAt },
    });
    return created;
  });

  return { series, content, visuals, nextRunAt };
}
