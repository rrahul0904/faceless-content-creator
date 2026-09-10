import { db } from '@/lib/db';
import { builtInTemplates } from '@/lib/template-engine/presets';
import { createTemplate } from '@/lib/template-engine/store';

export const runtime = 'nodejs';

export async function POST() {
  const created = [];
  for (const builtIn of builtInTemplates) {
    const existing = await db.template.findFirst({ where: { name: builtIn.name, workspaceId: null } });
    if (existing) {
      created.push({ id: existing.id, name: existing.name, existing: true });
      continue;
    }
    const template = await createTemplate(builtIn);
    created.push({ id: template.id, name: template.name, existing: false });
  }

  return Response.json({ ok: true, data: created });
}
