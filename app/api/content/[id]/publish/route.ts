import { z } from 'zod';
import { db } from '@/lib/db';
import { publishVideo } from '@/lib/orshot';

const Input = z.object({
  accountIds: z.array(z.number().int().positive()).min(1),
  draft: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

function extractPostId(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const direct = record.id;
  if (typeof direct === 'number') return direct;
  const data = record.data;
  if (data && typeof data === 'object') {
    const post = (data as Record<string, unknown>).post;
    if (post && typeof post === 'object' && typeof (post as Record<string, unknown>).id === 'number') {
      return (post as Record<string, unknown>).id as number;
    }
  }
  return undefined;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = Input.parse(await request.json());
    const content = await db.contentItem.findUnique({ where: { id } });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.videoUrl) {
      return Response.json({ ok: false, error: 'Content must have a rendered video before publishing' }, { status: 409 });
    }
    if (content.status !== 'APPROVED' && !payload.draft) {
      return Response.json({ ok: false, error: 'Approve content before scheduling or publishing it' }, { status: 409 });
    }

    const result = await publishVideo({
      videoUrl: content.videoUrl,
      caption: content.caption ?? content.hook ?? content.topic,
      accountIds: payload.accountIds,
      draft: payload.draft,
      scheduledFor: payload.scheduledFor,
      timezone: payload.timezone,
    });

    const postId = extractPostId(result);
    const nextStatus = payload.draft ? 'REVIEW' : payload.scheduledFor ? 'SCHEDULED' : 'PUBLISHED';

    await db.$transaction([
      db.contentItem.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(payload.scheduledFor ? { scheduledFor: new Date(payload.scheduledFor) } : {}),
          ...(!payload.draft && !payload.scheduledFor ? { publishedAt: new Date() } : {}),
        },
      }),
      ...payload.accountIds.map((accountId) => db.publication.create({
        data: {
          contentId: id,
          platform: 'connected',
          accountId,
          externalId: postId ? String(postId) : null,
          status: payload.draft ? 'draft' : payload.scheduledFor ? 'scheduled' : 'processing',
          raw: result,
        },
      })),
    ]);

    return Response.json({ ok: true, result, contentStatus: nextStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish content';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
