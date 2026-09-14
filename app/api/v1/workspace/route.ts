import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';
import { getUsageSummary } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const [channels, templates, brandAssets, socialAccounts, renderJobs, billing, usage] = await Promise.all([
      db.channel.count({ where: { workspaceId: workspace.id } }),
      db.template.count({ where: { workspaceId: workspace.id } }),
      db.brandAsset.count({ where: { workspaceId: workspace.id } }),
      db.socialAccount.count({ where: { workspaceId: workspace.id } }),
      db.renderJob.count({ where: { workspaceId: workspace.id } }),
      db.billingSubscription.findUnique({ where: { workspaceId: workspace.id } }),
      getUsageSummary(workspace.id, 30),
    ]);

    return Response.json({
      ok: true,
      data: {
        workspace,
        localMode: workspace.slug === 'local',
        counts: { channels, templates, brandAssets, socialAccounts, renderJobs },
        billing,
        usage: {
          days: usage.days,
          totals: usage.totals,
          eventCount: usage.eventCount,
          creditBalance: usage.creditBalance,
        },
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load workspace';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
