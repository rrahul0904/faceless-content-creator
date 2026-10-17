import { compileVisualStoryCarousel } from '@/lib/visual-story/carousel';
import { currentVisualStorySpec } from '@/lib/visual-story/store';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const current = await currentVisualStorySpec(id, workspace.id);
    if (!current) return Response.json({ ok: false, error: 'Visual story not found' }, { status: 404 });
    const carousel = compileVisualStoryCarousel(current.spec, {
      itemsPerSlide: Number(body?.itemsPerSlide ?? 2),
      sourceVersion: current.version,
    });
    const blocked = carousel.slides.filter((slide) => slide.qa.status !== 'PASS');
    return Response.json({
      ok: blocked.length === 0,
      source: { visualStoryId: id, version: current.version },
      data: carousel,
      blockedSlides: blocked.map((slide) => ({ index: slide.index, qa: slide.qa })),
    }, { status: blocked.length ? 422 : 200 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to compile saved visual story carousel';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
