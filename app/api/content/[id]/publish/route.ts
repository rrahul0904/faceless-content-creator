import { z } from 'zod';
import { db } from '@/lib/db';

const Input = z.object({
  accountIds: z.array(z.string().cuid()).min(1),
  draft: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = Input.parse(await request.json());
    const content = await db.contentItem.findUnique({ where: { id } });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.videoUrl) {
      return Response.json({ ok: false, error: 'Content must have a rendered video before publishing' }, { status: 409 });
    }

    const accounts = await db.socialAccount.findMany({ where: { id: { in: payload.accountIds } } });
    if (accounts.length !== payload.accountIds.length) {
      return Response.json({ ok: false, error: 'One or more social accounts were not found' }, { status: 404 });
    }

    const disconnected = accounts.filter((account) => account.status !== 'connected');
    if (disconnected.length) {
      return Response.json({
        ok: false,
        error: 'Native social publishing requires a connected platform account. Rendering and MP4 export remain fully zero-config.',
        disconnected: disconnected.map((account) => ({ id: account.id, platform: account.platform, label: account.label })),
      }, { status: 409 });
    }

    return Response.json({
      ok: false,
      error: 'Native YouTube, Instagram and TikTok OAuth adapters are not enabled in this build yet. No third-party publishing proxy is being used.',
      requested: {
        contentId: id,
        accountIds: payload.accountIds,
        draft: payload.draft ?? false,
        scheduledFor: payload.scheduledFor ?? null,
      },
    }, { status: 501 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare publication';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
