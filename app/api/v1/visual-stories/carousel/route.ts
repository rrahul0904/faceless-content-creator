import { compileVisualStoryCarousel } from '@/lib/visual-story/carousel';
import { VisualStorySpecSchema } from '@/lib/visual-story/schema';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await resolveWorkspace(request);
    const body = await request.json();
    const spec = VisualStorySpecSchema.parse(body?.spec);
    const itemsPerSlide = Number(body?.itemsPerSlide ?? 2);
    const carousel = compileVisualStoryCarousel(spec, { itemsPerSlide });
    const blocked = carousel.slides.filter((slide) => slide.qa.status !== 'PASS');
    return Response.json({
      ok: blocked.length === 0,
      data: carousel,
      blockedSlides: blocked.map((slide) => ({ index: slide.index, qa: slide.qa })),
    }, { status: blocked.length ? 422 : 200 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to compile visual story carousel';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
