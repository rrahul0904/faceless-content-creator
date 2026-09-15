import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';
import { getUsageSummary } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const url = new URL(request.url);
    const rawDays = Number.parseInt(url.searchParams.get('days') || '30', 10);
    const days = Number.isFinite(rawDays) ? rawDays : 30;
    const summary = await getUsageSummary(workspace.id, days);
    return Response.json({ ok: true, data: { workspaceId: workspace.id, ...summary } });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load usage';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
