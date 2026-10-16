import { deleteVisualStory, getVisualStory, updateVisualStory } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const story = await getVisualStory(id, workspace.id);
    if (!story) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    return Response.json({ ok: true, data: story });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load visual story';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const body = await request.json();
    const story = await updateVisualStory(id, { name: body.name, spec: body.spec ?? body }, workspace.id);
    if (!story) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    return Response.json({ ok: true, data: story });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to update visual story';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const deleted = await deleteVisualStory(id, workspace.id);
    if (!deleted) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    return Response.json({ ok: true, deleted: true });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to delete visual story';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
