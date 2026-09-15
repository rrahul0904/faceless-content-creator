import { z } from 'zod';
import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { createLocalRenderJob } from '@/lib/render-queue';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const RenderRequest = z.object({
  hook: z.string().min(1).max(280),
  script: z.string().min(1).max(6000),
  topic: z.string().min(1).max(500),
  caption: z.string().max(2200).optional(),
  voice: z.enum(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']).default('en-us'),
  speechRate: z.number().int().min(110).max(230).default(165),
  template: z.enum(['editorial', 'signal', 'ember']).default('editorial'),
  contentId: z.string().cuid().optional(),
});

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = RenderRequest.parse(await request.json());
    await enforceUsageLimit(workspace, 'RENDER_JOB');
    const job = await createLocalRenderJob(payload, payload.contentId, workspace.id);

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        workspaceId: workspace.id,
        status: job.status.toLowerCase(),
        finished: false,
        engine: 'local-ffmpeg',
        template: payload.template,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to start local render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
