import { getRenderJob } from '@/lib/orshot';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return Response.json({ ok: false, error: 'Invalid render job id' }, { status: 400 });
    }
    const job = await getRenderJob(parsed);
    return Response.json({ ok: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load render job';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
