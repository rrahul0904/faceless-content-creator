import { listVisualStoryVersions } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const versions = await listVisualStoryVersions(id, workspace.id);
    if (!versions) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    return Response.json({ ok: true, data: versions });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to list visual story versions';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
