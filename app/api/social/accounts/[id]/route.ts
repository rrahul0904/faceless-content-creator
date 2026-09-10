import { z } from 'zod';
import { db } from '@/lib/db';
import { encryptToken, tokenStorageReady } from '@/lib/token-crypto';

const PatchAccount = z.object({
  label: z.string().min(1).max(120).optional(),
  username: z.string().max(120).nullable().optional(),
  accessToken: z.string().min(1).nullable().optional(),
  refreshToken: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = PatchAccount.parse(await request.json());
    if ((payload.accessToken || payload.refreshToken) && !tokenStorageReady()) {
      return Response.json({ ok: false, error: 'Set SOCIAL_TOKEN_KEY (or APP_SECRET) before storing platform credentials.' }, { status: 503 });
    }

    const existing = await db.socialAccount.findUnique({ where: { id } });
    if (!existing) return Response.json({ ok: false, error: 'Social account not found' }, { status: 404 });

    const account = await db.socialAccount.update({
      where: { id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.username !== undefined ? { username: payload.username } : {}),
        ...(payload.accessToken !== undefined
          ? { accessTokenEncrypted: payload.accessToken ? encryptToken(payload.accessToken) : null }
          : {}),
        ...(payload.refreshToken !== undefined
          ? { refreshTokenEncrypted: payload.refreshToken ? encryptToken(payload.refreshToken) : null }
          : {}),
        ...(payload.metadata !== undefined ? { metadata: payload.metadata ?? undefined } : {}),
        ...(payload.status !== undefined
          ? { status: payload.status }
          : payload.accessToken
            ? { status: 'connected' }
            : {}),
      },
    });

    return Response.json({
      ok: true,
      account: {
        id: account.id,
        platform: account.platform,
        account_name: account.label,
        account_username: account.username,
        status: account.status,
        metadata: account.metadata,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update social account';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await db.socialAccount.findUnique({ where: { id } });
    if (!existing) return Response.json({ ok: false, error: 'Social account not found' }, { status: 404 });
    await db.socialAccount.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove social account';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
