import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const args = process.argv.slice(2);

function valueFor(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function has(flag) {
  return args.includes(flag);
}

function usage() {
  console.error('Usage: node scripts/create-api-key.mjs --workspace <slug> --name <label> [--days <n>]');
  process.exitCode = 2;
}

const workspaceSlug = valueFor('--workspace', 'local');
const name = valueFor('--name', 'Operator key');
const daysRaw = valueFor('--days', '');
const days = daysRaw ? Number.parseInt(daysRaw, 10) : null;

if (has('--help')) {
  usage();
} else if (!workspaceSlug || !name || (days !== null && (!Number.isFinite(days) || days < 1 || days > 3650))) {
  usage();
} else {
  try {
    let workspace = await db.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace && workspaceSlug === 'local') {
      workspace = await db.workspace.create({
        data: { name: 'Local Workspace', slug: 'local', plan: 'FREE', status: 'ACTIVE' },
      });
    }
    if (!workspace) throw new Error(`Workspace slug '${workspaceSlug}' was not found`);
    if (workspace.status !== 'ACTIVE') throw new Error(`Workspace '${workspaceSlug}' is not active`);

    const plaintext = `fcc_${randomBytes(32).toString('base64url')}`;
    const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const record = await db.apiKey.create({
      data: {
        workspaceId: workspace.id,
        name,
        keyPrefix: plaintext.slice(0, 16),
        keyHash: createHash('sha256').update(plaintext, 'utf8').digest('hex'),
        expiresAt,
      },
    });

    console.log(JSON.stringify({
      ok: true,
      apiKey: plaintext,
      keyId: record.id,
      keyPrefix: record.keyPrefix,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      warning: 'This is the only time the full API key is returned. Store it securely.',
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
