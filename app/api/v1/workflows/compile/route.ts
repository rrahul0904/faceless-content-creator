import { z, ZodError } from 'zod';
import { enforceMeteredRate, planLimitResponse } from '@/lib/limits';
import { compileWorkflow, estimateWorkflowCost } from '@/lib/workflow-compiler';
import type { WorkflowCapture } from '@/lib/workflow-compiler';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const WorkflowEventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['click', 'input', 'navigation', 'submit', 'wait', 'custom']),
  atMs: z.number().finite().nonnegative(),
  label: z.string().min(1),
  target: z.string().optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  sensitive: z.boolean().optional(),
});

const TranscriptSegmentSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
  text: z.string().min(1),
});

const VisualEvidenceSchema = z.object({
  id: z.string().min(1),
  uri: z.string().min(1),
  capturedAtMs: z.number().finite().nonnegative(),
  sensitive: z.boolean().optional(),
});

const RateCardSchema = z.object({
  aiVideoPerMinute: z.number().finite().nonnegative().optional(),
  aiDocumentFlat: z.number().finite().nonnegative().optional(),
  translationPerMinute: z.number().finite().nonnegative().optional(),
  avatarPerMinute: z.number().finite().nonnegative().optional(),
}).optional();

const CompileWorkflowRequestSchema = z.object({
  workflowId: z.string().min(1),
  captureId: z.string().min(1),
  durationMs: z.number().finite().nonnegative(),
  events: z.array(WorkflowEventSchema).min(1),
  transcript: z.array(TranscriptSegmentSchema).optional(),
  evidence: z.array(VisualEvidenceSchema).optional(),
  cost: z.object({
    includeVideo: z.boolean().default(true),
    includeGuide: z.boolean().default(true),
    languages: z.array(z.string()).optional(),
    includeAvatar: z.boolean().optional(),
    rates: RateCardSchema,
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = CompileWorkflowRequestSchema.parse(await request.json());
    await enforceMeteredRate(workspace);

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
      includeVideo: payload.cost?.includeVideo ?? true,
      includeGuide: payload.cost?.includeGuide ?? true,
      languages: payload.cost?.languages,
      includeAvatar: payload.cost?.includeAvatar,
      rates: payload.cost?.rates,
    });

    return Response.json({
      ok: true,
      workspaceId: workspace.id,
      data: {
        ...artifacts,
        cost,
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;

    const limitError = planLimitResponse(error);
    if (limitError) return limitError;

    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid workflow capture request', issues: error.issues },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unable to compile workflow';
    return Response.json({ ok: false, error: message }, { status: 422 });
  }
}
