import { authenticateWorkspaceApiKey, bearerApiKey } from '@/lib/api-keys';
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

function authMode() {
  return process.env.FCC_AUTH_MODE === 'api-key' ? 'api-key' : 'local';
}

function trustedWorkspaceHeaders() {
  return process.env.TRUST_WORKSPACE_HEADERS === 'true' || process.env.NODE_ENV !== 'production';
}

export async function ensureLocalWorkspace() {
  const workspace = await db.workspace.upsert({
    where: { slug: LOCAL_WORKSPACE_SLUG },
    update: {},
    create: {
      name: 'Local Workspace',
      slug: LOCAL_WORKSPACE_SLUG,
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });

  // Upgrade existing single-user installs without making their data disappear when
  // tenant filters become active. These updates are idempotent and only claim rows
  // that predate workspace ownership.
  await db.$transaction([
    db.channel.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    db.template.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    db.brandAsset.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    db.socialAccount.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    db.renderJob.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
  ]);

  return workspace;
}

export async function resolveWorkspace(request?: Request) {
  const apiKey = bearerApiKey(request);
  if (apiKey) {
    const authenticated = await authenticateWorkspaceApiKey(apiKey);
    if (!authenticated) throw new WorkspaceResolutionError('Invalid, expired, or revoked API key', 401);
    return authenticated.workspace;
  }

  if (authMode() === 'api-key') {
    throw new WorkspaceResolutionError('A workspace API key is required', 401);
  }

  const workspaceId = request?.headers.get('x-workspace-id')?.trim();
  const workspaceSlug = request?.headers.get('x-workspace-slug')?.trim();
  if ((workspaceId || workspaceSlug) && !trustedWorkspaceHeaders()) {
    throw new WorkspaceResolutionError('Workspace selector headers are disabled in production', 403);
  }

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
