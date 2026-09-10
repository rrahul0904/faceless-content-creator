import { z } from 'zod';
import { db } from '@/lib/db';

const ContentInput = z.object({
  channelId: z.string().min(1),
  topic: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  hook: z.string().optional(),
  script: z.string().optional(),
  caption: z.string().optional(),
  statNumber: z.string().optional(),
  statLabel: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const channelId = url.searchParams.get('channelId') ?? undefined;
  const contents = await db.contentItem.findMany({
    where: channelId ? { channelId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { publications: true },
    take: 100,
  });
  return Response.json({ ok: true, contents });
}

export async function POST(request: Request) {
  try {
    const payload = ContentInput.parse(await request.json());
    const content = await db.contentItem.create({
      data: {
        ...payload,
        status: payload.script ? 'SCRIPTED' : 'IDEA',
      },
    });
    return Response.json({ ok: true, content }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
