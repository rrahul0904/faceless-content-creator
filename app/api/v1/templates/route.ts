import { createTemplate, listTemplates } from '@/lib/template-engine/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId') || undefined;
  const templates = await listTemplates(workspaceId);
  return Response.json({ ok: true, data: templates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : undefined;
    const template = await createTemplate(body.template ?? body, workspaceId);
    return Response.json({ ok: true, data: template }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create template';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
