import { ZodError } from 'zod';
import { compileSemanticTimeline, SemanticTimelineCompileError } from '@/lib/semantic-video/compile';
import { SemanticTimelineRequestSchema } from '@/lib/semantic-video/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = SemanticTimelineRequestSchema.parse(await request.json());
    const compiled = compileSemanticTimeline(payload);
    return Response.json({ ok: true, data: compiled });
  } catch (error) {
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
