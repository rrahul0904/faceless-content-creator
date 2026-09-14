import { db } from '@/lib/db';

export const LOCAL_WORKSPACE_SLUG = 'local';

export class WorkspaceResolutionError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = 'WorkspaceResolutionError';
    this.status = status;
  }
}

export async function ensureLocalWorkspace() {
  return db.workspace.upsert({
    where: { slug: LOCAL_WORKSPACE_SLUG },
    update: {},
    create: {
      name: 'Local Workspace',
      slug: LOCAL_WORKSPACE_SLUG,
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });
}

export async function resolveWorkspace(request?: Request) {
  const workspaceId = request?.headers.get('x-workspace-id')?.trim();
  const workspaceSlug = request?.headers.get('x-workspace-slug')?.trim();

  if (workspaceId) {
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new WorkspaceResolutionError('Workspace not found');
    if (workspace.status !== 'ACTIVE') throw new WorkspaceResolutionError('Workspace is not active', 403);
    return workspace;
  }

  if (workspaceSlug) {
    const workspace = await db.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) throw new WorkspaceResolutionError('Workspace not found');
    if (workspace.status !== 'ACTIVE') throw new WorkspaceResolutionError('Workspace is not active', 403);
    return workspace;
  }

  return ensureLocalWorkspace();
}

export function workspaceErrorResponse(error: unknown) {
  if (error instanceof WorkspaceResolutionError) {
    return Response.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}
