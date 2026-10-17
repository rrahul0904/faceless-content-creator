import { createVisualStory, listVisualStories } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const stories = await listVisualStories(workspace.id);
    return Response.json({ ok: true, data: stories });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to list visual stories';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const body = await request.json();
    const story = await createVisualStory({ name: body.name, spec: body.spec ?? body }, workspace.id);
    return Response.json({ ok: true, data: story }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create visual story';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
