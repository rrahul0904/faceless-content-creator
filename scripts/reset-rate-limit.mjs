import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const args = process.argv.slice(2);
const workspaceArg = args.findIndex((value) => value === '--workspace');
const slug = workspaceArg >= 0 ? args[workspaceArg + 1] : 'local';

try {
  const workspace = await db.workspace.findUnique({ where: { slug } });
  if (!workspace) throw new Error(`Workspace not found: ${slug}`);
  const deleted = await db.setting.deleteMany({
    where: { key: { startsWith: `rate-limit:${workspace.id}:` } },
  });
  console.log(JSON.stringify({ ok: true, workspaceId: workspace.id, slug, deleted: deleted.count }));
} finally {
  await db.$disconnect();
}
