import { z } from 'zod';
import { db } from '@/lib/db';

const CreateAccount = z.object({
  platform: z.enum(['youtube', 'instagram', 'tiktok']),
  label: z.string().min(1).max(120),
  username: z.string().max(120).optional(),
});

export async function GET() {
  try {
    const accounts = await db.socialAccount.findMany({ orderBy: { createdAt: 'asc' } });
    return Response.json({
      ok: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        account_name: account.label,
        account_username: account.username ?? undefined,
        status: account.status,
        requires_reconnect: account.status !== 'connected',
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
    const account = await db.socialAccount.create({
      data: {
        platform: payload.platform,
        label: payload.label,
        username: payload.username,
        status: 'disconnected',
      },
    });
    return Response.json({ ok: true, account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create social account';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
