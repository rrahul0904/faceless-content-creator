import { compileFilmPlan, FilmPlanError } from '@/lib/agent-film/film-plan.mjs';
import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { queueTemplateRender } from '@/lib/template-engine/render';
import { TemplateDocumentSchema } from '@/lib/template-engine/schema';
import { createTemplate } from '@/lib/template-engine/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Workspace auth is checked even for preview-only plans.
    const workspace = await resolveWorkspace(request);
    const raw = await request.text();
    if (raw.length > 128 * 1024) {
      return Response.json({ ok: false, error: 'FilmPlan request exceeds 128 KiB' }, { status: 413 });
    }
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new FilmPlanError('Expected an object with plan');
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') throw new FilmPlanError('dryRun must be boolean');
    if (body.render !== undefined && typeof body.render !== 'boolean') throw new FilmPlanError('render must be boolean');
    const compiled = compileFilmPlan(body.plan);
    const document = TemplateDocumentSchema.parse(compiled.document);
    const evidence = {
      planHash: compiled.planHash, compiler: 'film-plan-v1',
      sceneCount: compiled.sceneCount, duration: compiled.duration,
    };

    if (body.dryRun === true) {
      return Response.json({ ok: true, data: { ...evidence, document } });
    }

    if (body.render === true) await enforceUsageLimit(workspace, 'RENDER_JOB');
    const created = await createTemplate(document, workspace.id);
    let renderJobId: string | null = null;
    if (body.render === true) {
      const queued = await queueTemplateRender(created.id, { modifications: {}, response: { format: 'mp4', mode: 'async' } }, workspace.id);
      renderJobId = queued?.job.id ?? null;
    }
    return Response.json({
      ok: true,
      data: { ...evidence, templateId: created.id, templateVersion: created.version, studioUrl: '/studio', renderJobId },
    }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Invalid FilmPlan';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
