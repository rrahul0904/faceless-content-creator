import { db } from '@/lib/db';
import { builtInTemplates } from '@/lib/template-engine/presets';
import { createTemplate } from '@/lib/template-engine/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const created = [];
    for (const builtIn of builtInTemplates) {
      const existing = await db.template.findFirst({ where: { name: builtIn.name, workspaceId: workspace.id } });
      if (existing) {
        created.push({ id: existing.id, name: existing.name, existing: true });
        continue;
      }
      const template = await createTemplate(builtIn, workspace.id);
      created.push({ id: template.id, name: template.name, existing: false });
    }

    return Response.json({ ok: true, data: created, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to bootstrap templates';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
