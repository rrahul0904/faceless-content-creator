import { z } from 'zod';
import { db } from '@/lib/db';
import { startPublishWorker } from '@/lib/publish-worker';

const Input = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(10),
  draft: z.boolean().default(false),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = Input.parse(await request.json());
    const content = await db.contentItem.findUnique({ where: { id }, include: { channel: true } });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.videoUrl) {
      return Response.json({ ok: false, error: 'Content must have a rendered video before publishing' }, { status: 409 });
    }

    const uniqueIds = [...new Set(payload.accountIds)];
    const accounts = await db.socialAccount.findMany({ where: { id: { in: uniqueIds } } });
    if (accounts.length !== uniqueIds.length) {
      return Response.json({ ok: false, error: 'One or more social accounts were not found' }, { status: 404 });
    }

    const disconnected = accounts.filter((account) => account.status !== 'connected' || !account.accessTokenEncrypted);
    if (disconnected.length) {
      return Response.json({
        ok: false,
        error: 'Every target account must have an encrypted access token and connected status before publishing.',
        disconnected: disconnected.map((account) => ({ id: account.id, platform: account.platform, label: account.label })),
      }, { status: 409 });
    }

    const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
    const isScheduled = Boolean(scheduledFor && scheduledFor.getTime() > Date.now() + 2_000);

    const publications = await db.$transaction(async (tx) => {
      const created = [];
      for (const account of accounts) {
        created.push(await tx.publication.create({
          data: {
            contentId: content.id,
            platform: account.platform,
            accountId: account.id,
            status: isScheduled ? 'SCHEDULED' : 'QUEUED',
            scheduledFor: isScheduled ? scheduledFor : null,
            raw: { request: { draft: payload.draft } },
          },
        }));
      }

      await tx.contentItem.update({
        where: { id: content.id },
        data: {
          status: isScheduled ? 'SCHEDULED' : 'APPROVED',
          scheduledFor: isScheduled ? scheduledFor : null,
        },
      });
      return created;
    });

    if (!isScheduled) {
      for (const publication of publications) startPublishWorker(publication.id);
    }

    return Response.json({
      ok: true,
      mode: isScheduled ? 'scheduled' : 'async',
      contentId: content.id,
      scheduledFor: isScheduled ? scheduledFor?.toISOString() : null,
      publications: publications.map((publication) => ({
        id: publication.id,
        platform: publication.platform,
        accountId: publication.accountId,
        status: publication.status.toLowerCase(),
      })),
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to queue publication';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
