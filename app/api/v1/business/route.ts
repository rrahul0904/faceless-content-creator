import { db } from '@/lib/db';
import { loadCharacterBusinessState, summarizeCharacterBusiness } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const state = await loadCharacterBusinessState(workspace.id);
    const metrics = summarizeCharacterBusiness(state);

    const publications = await db.publication.findMany({
      where: { content: { channel: { workspaceId: workspace.id } } },
      select: { platform: true, views: true, likes: true, comments: true, shares: true, saves: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const reachByPlatform = publications.reduce<Record<string, { publications: number; views: number; engagements: number }>>(
      (acc, publication) => {
        const current = acc[publication.platform] ?? { publications: 0, views: 0, engagements: 0 };
        current.publications += 1;
        current.views += publication.views ?? 0;
        current.engagements +=
          (publication.likes ?? 0) +
          (publication.comments ?? 0) +
          (publication.shares ?? 0) +
          (publication.saves ?? 0);
        acc[publication.platform] = current;
        return acc;
      },
      {},
    );

    return Response.json({
      ok: true,
      workspaceId: workspace.id,
      state,
      metrics,
      social: {
        publicationCount: publications.length,
        reachByPlatform,
      },
      productPrinciple: 'Optimize for audience-owned revenue and gross profit, not platform RPM alone.',
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load character business dashboard';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
