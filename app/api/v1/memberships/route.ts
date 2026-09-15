import { z } from 'zod';
import { db } from '@/lib/db';
import { assertMemberCapacity, planLimitResponse } from '@/lib/limits';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Role = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
const CreateMembership = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(120).optional(),
  role: Role.default('EDITOR'),
});

function memberView(member: {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; email: string; name: string | null; imageUrl: string | null };
}) {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    user: member.user,
  };
}

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const members = await db.membership.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return Response.json({ ok: true, data: members.map(memberView), workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to list memberships';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = CreateMembership.parse(await request.json());
    const email = payload.email.toLowerCase();

    const existing = await db.membership.findFirst({
      where: { workspaceId: workspace.id, user: { email } },
      include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
    });

    if (existing) {
      const updated = payload.name && payload.name !== existing.user.name
        ? await db.$transaction(async (tx) => {
            await tx.user.update({ where: { id: existing.user.id }, data: { name: payload.name } });
            return tx.membership.findUniqueOrThrow({
              where: { id: existing.id },
              include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
            });
          })
        : existing;
      return Response.json({ ok: true, created: false, data: memberView(updated), workspaceId: workspace.id });
    }

    await assertMemberCapacity(workspace);
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: payload.name ? { name: payload.name } : {},
        create: { email, name: payload.name },
      });
      return tx.membership.create({
        data: { workspaceId: workspace.id, userId: user.id, role: payload.role },
        include: { user: { select: { id: true, email: true, name: true, imageUrl: true } } },
      });
    });

    return Response.json({ ok: true, created: true, data: memberView(created), workspaceId: workspace.id }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to create membership';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
