import { ZodError } from 'zod';
import { enforceMeteredRate, planLimitResponse } from '@/lib/limits';
import { analyzeReferenceVideo } from '@/lib/reference-video/analyze';
import { ReferenceVideoAnalyzeRequestSchema } from '@/lib/reference-video/schema';
import { LOCAL_WORKSPACE_SLUG, resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = ReferenceVideoAnalyzeRequestSchema.parse(await request.json());
    const owned = payload.filename.startsWith(`${workspace.id}__`);
    const legacyLocal = workspace.slug === LOCAL_WORKSPACE_SLUG && !payload.filename.includes('__');
    if (!owned && !legacyLocal) {
      return Response.json({ ok: false, error: 'Reference video not found' }, { status: 404 });
    }

    await enforceMeteredRate(workspace);
    const analysis = await analyzeReferenceVideo(payload);
    return Response.json({ ok: true, data: analysis, workspaceId: workspace.id });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid reference-video analysis request', issues: error.issues }, { status: 400 });
    }

    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') return Response.json({ ok: false, error: 'Reference video not found' }, { status: 404 });

    const message = error instanceof Error ? error.message : 'Unable to analyze reference video';
    const status = message.includes('supports MP4') || message.includes('Invalid reference filename') ? 400 : 422;
    return Response.json({ ok: false, error: message }, { status });
  }
}
