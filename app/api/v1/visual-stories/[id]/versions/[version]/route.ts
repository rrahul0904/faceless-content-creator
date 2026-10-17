import { getVisualStoryVersion, restoreVisualStoryVersion } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

function parseVersion(raw: string) {
  const version = Number(raw);
  return Number.isInteger(version) && version > 0 ? version : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string; version: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id, version: rawVersion } = await context.params;
    const version = parseVersion(rawVersion);
    if (!version) return Response.json({ ok: false, error: 'Invalid visual story version' }, { status: 400 });
    const saved = await getVisualStoryVersion(id, version, workspace.id);
    if (!saved) return Response.json({ ok: false, error: 'Visual story version not found' }, { status: 404 });
    return Response.json({ ok: true, data: saved });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load visual story version';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string; version: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id, version: rawVersion } = await context.params;
    const version = parseVersion(rawVersion);
    if (!version) return Response.json({ ok: false, error: 'Invalid visual story version' }, { status: 400 });
    const restored = await restoreVisualStoryVersion(id, version, workspace.id);
    if (!restored) return Response.json({ ok: false, error: 'Visual story version not found' }, { status: 404 });
    return Response.json({ ok: true, data: restored });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to restore visual story version';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
