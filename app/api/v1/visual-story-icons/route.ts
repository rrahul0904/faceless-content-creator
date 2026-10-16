import { searchTechnicalIcons, technicalIconRegistryInfo } from '@/lib/visual-story/icons';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const url = new URL(request.url);
    const query = String(url.searchParams.get('q') ?? '').slice(0, 160);
    const provider = String(url.searchParams.get('provider') ?? '').slice(0, 40);
    const icons = searchTechnicalIcons(query, provider).slice(0, 100);
    return Response.json({
      ok: true,
      workspaceId: workspace.id,
      registry: technicalIconRegistryInfo(),
      data: icons,
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to read technical icon registry';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
