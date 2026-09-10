import { listSocialAccounts } from '@/lib/orshot';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeHealth = url.searchParams.get('health') !== '0';
    const result = await listSocialAccounts(includeHealth);
    return Response.json({ ok: true, accounts: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load social accounts';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
