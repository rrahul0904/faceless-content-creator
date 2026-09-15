import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

const API_KEY_PREFIX = 'fcc_';

export function hashApiKey(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function apiKeyPrefix(value: string) {
  return value.slice(0, Math.min(16, value.length));
}

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export async function createWorkspaceApiKey(input: {
  workspaceId: string;
  name: string;
  expiresAt?: Date | null;
}) {
  const workspace = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!workspace) throw new Error('Workspace not found');
  if (workspace.status !== 'ACTIVE') throw new Error('Workspace is not active');

  const plaintext = generateApiKey();
  const record = await db.apiKey.create({
    data: {
      workspaceId: workspace.id,
      name: input.name,
      keyPrefix: apiKeyPrefix(plaintext),
      keyHash: hashApiKey(plaintext),
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { plaintext, record, workspace };
}

export async function authenticateWorkspaceApiKey(value: string) {
  if (!value.startsWith(API_KEY_PREFIX) || value.length < API_KEY_PREFIX.length + 20) return null;
  const now = new Date();
  const record = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(value) },
    include: { workspace: true },
  });

  if (!record || record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt <= now) return null;
  if (record.workspace.status !== 'ACTIVE') return null;

  await db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: now } });
  return { apiKey: record, workspace: record.workspace };
}

export function bearerApiKey(request?: Request) {
  const authorization = request?.headers.get('authorization')?.trim();
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  const value = match[1].trim();
  return value.startsWith(API_KEY_PREFIX) ? value : null;
}
