import { db } from '@/lib/db';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SourceStory = { id: string; version: number } | null;

function jobMetadata(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { kind: 'unknown', format: 'mp4', engine: 'local-ffmpeg', sourceStory: null as SourceStory };
  }
  const record = input as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? record.kind : 'legacy-local';
  const format = record.output === 'gif' ? 'gif' : 'mp4';
  const engine = kind === 'visual-story-v1' ? 'visual-story-template-v1' : kind === 'template-v1' ? 'template-engine-v1' : 'local-ffmpeg';
  let sourceStory: SourceStory = null;
  if (record.sourceStory && typeof record.sourceStory === 'object' && !Array.isArray(record.sourceStory)) {
    const source = record.sourceStory as Record<string, unknown>;
    if (typeof source.id === 'string' && Number.isInteger(source.version) && Number(source.version) > 0) {
      sourceStory = { id: source.id, version: Number(source.version) };
    }
  }
  return { kind, format, engine, sourceStory };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const job = await db.renderJob.findFirst({
      where: { id, workspaceId: workspace.id },
      select: {
        id: true,
        workspaceId: true,
        templateId: true,
        status: true,
        cancelRequested: true,
        input: true,
        videoUrl: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!job) return Response.json({ ok: false, error: 'Render job not found' }, { status: 404 });

    const finished = job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELLED';
    const metadata = jobMetadata(job.input);
    return Response.json({
      ok: true,
      data: {
        id: job.id,
        workspaceId: job.workspaceId,
        templateId: job.templateId,
        status: job.status.toLowerCase(),
        cancelRequested: job.cancelRequested,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        finished,
        cancellable: !finished,
        kind: metadata.kind,
        engine: metadata.engine,
        sourceStory: metadata.sourceStory,
        result: job.status === 'SUCCEEDED' && job.videoUrl ? { url: job.videoUrl, format: metadata.format } : null,
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load render job';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
