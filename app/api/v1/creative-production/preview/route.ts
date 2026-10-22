import { ZodError, z } from 'zod';
import { db } from '@/lib/db';
import { enforceMeteredRate, planLimitResponse } from '@/lib/limits';
import { CreativePreviewError, previewCreativeProduction } from '@/lib/creative-production/preview';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  product: z.object({
    name: z.string().trim().min(1).max(120),
    assetId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128),
    visualAnchors: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
    claims: z.array(z.object({
      text: z.string().trim().min(1).max(240),
      sourceUrl: z.string().max(1000),
    }).strict()).min(1).max(8),
  }).strict(),
  brief: z.object({
    format: z.enum(['ugc', 'product-ad', 'cartoon-ad']),
    audience: z.string().trim().min(1).max(160),
    objective: z.enum(['awareness', 'consideration', 'conversion']),
    channel: z.enum(['instagram', 'tiktok', 'youtube', 'linkedin']),
    durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 32_768) {
      return Response.json({ ok: false, error: 'Request too large' }, { status: 413 });
    }
    const payload = RequestSchema.parse(await request.json());

    // Lookup is deliberately tenant-scoped. Preview does not fetch third-party URLs or media.
    const asset = await db.brandAsset.findFirst({
      where: { id: payload.product.assetId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!asset) return Response.json({ ok: false, error: 'Brand asset not found' }, { status: 404 });
    await enforceMeteredRate(workspace);

    const preview = previewCreativeProduction(workspace.id, payload);
    return Response.json({ ok: true, data: preview });
  } catch (error) {
    const authError = workspaceErrorResponse(error);
    if (authError) return authError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid creative-preview request', issues: error.issues }, { status: 400 });
    }
    if (error instanceof CreativePreviewError) {
      return Response.json({ ok: false, error: error.message, code: error.code }, { status: 422 });
    }
    return Response.json({ ok: false, error: 'Unable to preview creative production' }, { status: 500 });
  }
}
