import { z } from 'zod';
import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { queueTemplateRender } from '@/lib/template-engine/render';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  templateId: z.string().min(1),
  modifications: z.record(z.string(), z.unknown()).default({}),
  response: z.object({
    format: z.literal('mp4').default('mp4'),
    mode: z.literal('async').default('async'),
    size: z.object({
      width: z.number().int().min(64).max(4096),
      height: z.number().int().min(64).max(4096),
    }).optional(),
  }).default({ format: 'mp4', mode: 'async' }),
});

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = RequestSchema.parse(await request.json());
    await enforceUsageLimit(workspace, 'RENDER_JOB');
    const queued = await queueTemplateRender(payload.templateId, payload, workspace.id);
    if (!queued) return Response.json({ ok: false, error: 'Template not found' }, { status: 404 });

    return Response.json({
      ok: true,
      data: {
        id: queued.job.id,
        jobId: queued.job.id,
        workspaceId: workspace.id,
        status: queued.job.status.toLowerCase(),
        mode: 'async',
        warnings: queued.warnings,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to queue render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
