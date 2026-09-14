import { deleteTemplate, getTemplate, updateTemplate } from '@/lib/template-engine/store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const template = await getTemplate(id);
  if (!template) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
  return Response.json({ ok: true, data: template });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const template = await updateTemplate(id, body.template ?? body);
    if (!template) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
    return Response.json({ ok: true, data: template });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update template';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await deleteTemplate(id);
  if (!deleted) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });
  return Response.json({ ok: true });
}
