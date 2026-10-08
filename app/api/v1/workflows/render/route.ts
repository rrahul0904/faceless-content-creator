import { z, ZodError } from 'zod';
import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import {
  assertPublishable,
  compileWorkflow,
  estimateWorkflowCost,
  guideToMarkdown,
  trainingTemplateFromWorkflow,
} from '@/lib/workflow-compiler';
import type { WorkflowCapture } from '@/lib/workflow-compiler';
import { queueTemplateRender } from '@/lib/template-engine/render';
import { createTemplate } from '@/lib/template-engine/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const EventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['click', 'input', 'navigation', 'submit', 'wait', 'custom']),
  atMs: z.number().finite().nonnegative(),
  label: z.string().min(1),
  target: z.string().optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  sensitive: z.boolean().optional(),
});

const TranscriptSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
  text: z.string().min(1),
});

const EvidenceSchema = z.object({
  id: z.string().min(1),
  uri: z.string().min(1),
  capturedAtMs: z.number().finite().nonnegative(),
  sensitive: z.boolean().optional(),
});

const RequestSchema = z.object({
  workflowId: z.string().min(1),
  captureId: z.string().min(1),
  durationMs: z.number().finite().nonnegative(),
  events: z.array(EventSchema).min(1),
  transcript: z.array(TranscriptSchema).optional(),
  evidence: z.array(EvidenceSchema).optional(),
  languages: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = RequestSchema.parse(await request.json());

    const capture: WorkflowCapture = {
      workspaceId: workspace.id,
      workflowId: payload.workflowId,
      captureId: payload.captureId,
      durationMs: payload.durationMs,
      events: payload.events,
      transcript: payload.transcript,
      evidence: payload.evidence,
    };

    const artifacts = compileWorkflow(capture);
    const cost = estimateWorkflowCost({
      durationMs: capture.durationMs,
      includeVideo: true,
      includeGuide: true,
      languages: payload.languages,
    });

    // Rendering is local/deterministic, but publication safety still follows the
    // source evidence. Sensitive captures must be reviewed before any export.
    assertPublishable(artifacts.videoPlan.reviewState);
    assertPublishable(artifacts.guide.reviewState);
    await enforceUsageLimit(workspace, 'RENDER_JOB');

    const templateDocument = trainingTemplateFromWorkflow(artifacts);
    const template = await createTemplate(templateDocument, workspace.id);
    const queued = await queueTemplateRender(template.id, {
      modifications: {},
      response: { format: 'mp4', mode: 'async', size: { width: 1920, height: 1080 } },
    }, workspace.id);

    if (!queued) {
      return Response.json({ ok: false, error: 'Unable to materialize workflow training template' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      workspaceId: workspace.id,
      data: {
        sourceRevisionId: artifacts.graph.revision.id,
        graph: artifacts.graph,
        guide: artifacts.guide,
        guideMarkdown: guideToMarkdown(artifacts.graph, artifacts.guide),
        videoPlan: artifacts.videoPlan,
        cost,
        templateId: template.id,
        renderJobId: queued.job.id,
        renderStatus: queued.job.status.toLowerCase(),
        renderUrl: `/api/v1/render-jobs/${queued.job.id}`,
        warnings: queued.warnings,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;

    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid workflow render request', issues: error.issues },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unable to render workflow';
    const status = message.includes('blocked pending review') ? 409 : 422;
    return Response.json({ ok: false, error: message }, { status });
  }
}
