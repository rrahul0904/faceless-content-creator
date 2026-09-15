import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const Role = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
const UpdateMembership = z.object({ role: Role });

async function membershipForWorkspace(workspaceId: string, id: string) {
  return db.membership.findFirst({
    where: { id, workspaceId },
    include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
  });
}

async function assertNotLastOwner(workspaceId: string, currentRole: string, nextRole?: string) {
  const removesOwner = currentRole === 'OWNER' && nextRole !== 'OWNER';
  if (!removesOwner) return;
  const owners = await db.membership.count({ where: { workspaceId, role: 'OWNER' } });
  if (owners <= 1) throw new Error('A workspace must retain at least one owner');
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const payload = UpdateMembership.parse(await request.json());
    const existing = await membershipForWorkspace(workspace.id, id);
    if (!existing) return Response.json({ ok: false, error: 'Membership not found' }, { status: 404 });

    await assertNotLastOwner(workspace.id, existing.role, payload.role);
    const updated = await db.membership.update({
      where: { id: existing.id },
      data: { role: payload.role },
      include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
    });
    return Response.json({ ok: true, data: updated, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to update membership';
    const status = message.includes('retain at least one owner') ? 409 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const existing = await membershipForWorkspace(workspace.id, id);
    if (!existing) return Response.json({ ok: false, error: 'Membership not found' }, { status: 404 });

    await assertNotLastOwner(workspace.id, existing.role);
    await db.membership.delete({ where: { id: existing.id } });
    return Response.json({ ok: true, deleted: true, id: existing.id, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to delete membership';
    const status = message.includes('retain at least one owner') ? 409 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}
