import { ZodError } from 'zod';
import { analyzeReferenceVideo } from '@/lib/reference-video/analyze';
import { ReferenceVideoAnalyzeRequestSchema } from '@/lib/reference-video/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = ReferenceVideoAnalyzeRequestSchema.parse(await request.json());
    const analysis = await analyzeReferenceVideo(payload);
    return Response.json({ ok: true, data: analysis });
  } catch (error) {
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
