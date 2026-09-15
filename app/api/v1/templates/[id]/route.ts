import { deleteTemplate, getTemplate, updateTemplate } from '@/lib/template-engine/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const template = await getTemplate(id, workspace.id);
    if (!template) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
    return Response.json({ ok: true, data: template });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load template';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const body = await request.json();
    const template = await updateTemplate(id, body.template ?? body, workspace.id);
    if (!template) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
    return Response.json({ ok: true, data: template });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to update template';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const deleted = await deleteTemplate(id, workspace.id);
    if (!deleted) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to delete template';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
