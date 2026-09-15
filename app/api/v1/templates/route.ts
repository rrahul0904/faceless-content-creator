import { createTemplate, listTemplates } from '@/lib/template-engine/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const templates = await listTemplates(workspace.id);
    return Response.json({ ok: true, data: templates });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to list templates';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const body = await request.json();
    const template = await createTemplate(body.template ?? body, workspace.id);
    return Response.json({ ok: true, data: template }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create template';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
