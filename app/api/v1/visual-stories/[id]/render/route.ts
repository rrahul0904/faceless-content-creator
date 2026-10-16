import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { createVisualStoryRenderJob } from '@/lib/render-queue';
import { certifyVisualStory } from '@/lib/visual-story/qa';
import { VisualStoryOutputSchema } from '@/lib/visual-story/schema';
import { currentVisualStorySpec } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const output = VisualStoryOutputSchema.parse(body.output ?? 'gif');
    const saved = await currentVisualStorySpec(id, workspace.id);
    if (!saved) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });

    const qa = certifyVisualStory(saved.spec);
    if (qa.status !== 'PASS') {
      return Response.json({ ok: false, error: 'VISUAL_STORY_QA_FAILED', qa }, { status: 422 });
    }

    await enforceUsageLimit(workspace, 'RENDER_JOB');
    const job = await createVisualStoryRenderJob(
      saved.spec,
      output,
      workspace.id,
      qa,
      { id, version: saved.version },
    );

    return Response.json({
      ok: true,
      qa,
      source: { visualStoryId: id, version: saved.version },
      job: {
        id: job.id,
        workspaceId: workspace.id,
        status: job.status.toLowerCase(),
        finished: false,
        kind: 'visual-story-v1',
        artifactType: output,
        engine: 'visual-story-template-v1',
        statusUrl: `/api/v1/render-jobs/${job.id}`,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to render saved visual story';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
