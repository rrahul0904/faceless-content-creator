import { ZodError } from 'zod';
import { enforceMeteredRate, planLimitResponse } from '@/lib/limits';
import { compileMathExplainer, MathExplainerCompileError } from '@/lib/math-explainer/compile';
import { MathExplainerDraftSchema } from '@/lib/math-explainer/schema';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const draft = MathExplainerDraftSchema.parse(await request.json());
    await enforceMeteredRate(workspace);
    const compiled = compileMathExplainer(draft);
    return Response.json({ ok: true, data: compiled, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;

    if (error instanceof MathExplainerCompileError) {
      return Response.json({
        ok: false,
        error: error.message,
        code: error.code,
        subjectId: error.subjectId,
      }, { status: 422 });
    }

    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid math explainer draft', issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Unable to compile math explainer';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
