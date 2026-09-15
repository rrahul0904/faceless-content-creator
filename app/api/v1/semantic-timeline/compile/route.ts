import { ZodError } from 'zod';
import { enforceMeteredRate, planLimitResponse } from '@/lib/limits';
import { compileSemanticTimeline, SemanticTimelineCompileError } from '@/lib/semantic-video/compile';
import { SemanticTimelineRequestSchema } from '@/lib/semantic-video/schema';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = SemanticTimelineRequestSchema.parse(await request.json());
    await enforceMeteredRate(workspace);
    const compiled = compileSemanticTimeline(payload);
    return Response.json({ ok: true, data: compiled, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    if (error instanceof SemanticTimelineCompileError) {
      return Response.json({
        ok: false,
        error: error.message,
        code: error.code,
        cueId: error.cueId,
      }, { status: 422 });
    }

    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid semantic timeline request', issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Unable to compile semantic timeline';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
