import { z } from 'zod';
import { db } from '@/lib/db';
import { encryptToken, tokenStorageReady } from '@/lib/token-crypto';

const CreateAccount = z.object({
  workspaceId: z.string().cuid().optional(),
  platform: z.enum(['youtube', 'instagram', 'tiktok']),
  label: z.string().min(1).max(120),
  username: z.string().max(120).optional(),
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || undefined;
    const accounts = await db.socialAccount.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return Response.json({
      ok: true,
      tokenStorageReady: tokenStorageReady(),
      accounts: accounts.map((account) => ({
        id: account.id,
        workspaceId: account.workspaceId,
        platform: account.platform,
        account_name: account.label,
        account_username: account.username ?? undefined,
        status: account.status,
        requires_reconnect: account.status !== 'connected' || !account.accessTokenEncrypted,
        metadata: account.metadata,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load social accounts';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = CreateAccount.parse(await request.json());
    if ((payload.accessToken || payload.refreshToken) && !tokenStorageReady()) {
      return Response.json({
        ok: false,
        error: 'Set SOCIAL_TOKEN_KEY (or APP_SECRET) before storing platform credentials.',
      }, { status: 503 });
    }

    const account = await db.socialAccount.create({
      data: {
        workspaceId: payload.workspaceId,
        platform: payload.platform,
        label: payload.label,
        username: payload.username,
        accessTokenEncrypted: payload.accessToken ? encryptToken(payload.accessToken) : null,
        refreshTokenEncrypted: payload.refreshToken ? encryptToken(payload.refreshToken) : null,
        metadata: payload.metadata ?? undefined,
        status: payload.accessToken ? 'connected' : 'disconnected',
      },
    });

    return Response.json({
      ok: true,
      account: {
        id: account.id,
        workspaceId: account.workspaceId,
        platform: account.platform,
        account_name: account.label,
        account_username: account.username,
        status: account.status,
        requires_reconnect: account.status !== 'connected',
        metadata: account.metadata,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create social account';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
