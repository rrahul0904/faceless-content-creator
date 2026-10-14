import { db } from '@/lib/db';
import { generateSeriesEpisode } from '@/lib/series-runner';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const series = await db.series.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!series) return Response.json({ ok: false, error: 'Series not found' }, { status: 404 });
    const result = await generateSeriesEpisode(series.id);
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to generate series episode';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
