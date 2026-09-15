import { getWorkspaceLimitSnapshot, planLimitResponse } from '@/lib/limits';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const limits = await getWorkspaceLimitSnapshot(workspace);
    return Response.json({ ok: true, data: { workspaceId: workspace.id, ...limits } });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to load workspace limits';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
