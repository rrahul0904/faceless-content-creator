import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { createVisualStoryRenderJob } from '@/lib/render-queue';
import { certifyVisualStory } from '@/lib/visual-story/qa';
import { VisualStoryRenderRequestSchema } from '@/lib/visual-story/schema';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = VisualStoryRenderRequestSchema.parse(await request.json());
    const qa = certifyVisualStory(payload.spec);
    if (qa.status !== 'PASS') {
      return Response.json({
        ok: false,
        error: 'VISUAL_STORY_QA_FAILED',
        qa,
      }, { status: 422 });
    }

    await enforceUsageLimit(workspace, 'RENDER_JOB');
    const job = await createVisualStoryRenderJob(payload.spec, payload.output, workspace.id, qa);
    return Response.json({
      ok: true,
      qa,
      job: {
        id: job.id,
        workspaceId: workspace.id,
        status: job.status.toLowerCase(),
        finished: false,
        kind: 'visual-story-v1',
        artifactType: payload.output,
        engine: 'visual-story-template-v1',
        statusUrl: `/api/v1/render-jobs/${job.id}`,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to start visual story render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
