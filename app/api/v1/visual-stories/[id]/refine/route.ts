import { refineVisualStory } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const body = await request.json();
    const instruction = String(body?.instruction || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!instruction) {
      return Response.json({ ok: false, error: 'REFINEMENT_INSTRUCTION_REQUIRED' }, { status: 400 });
    }

    const story = await refineVisualStory(id, instruction, workspace.id);
    if (!story) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    return Response.json({ ok: true, data: story });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to refine visual story';
    const status = message.startsWith('REFINEMENT_') ? 422 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}
