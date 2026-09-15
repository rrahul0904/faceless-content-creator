import { z } from 'zod';
import { db } from '@/lib/db';
import { createLocalRenderJob, type LocalTemplate } from '@/lib/render-queue';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const Input = z.object({
  voice: z.enum(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']).optional(),
  speechRate: z.number().int().min(110).max(230).optional(),
  template: z.enum(['editorial', 'signal', 'ember']).optional(),
});

function localTemplate(value: string | null | undefined): LocalTemplate {
  return value === 'signal' || value === 'ember' ? value : 'editorial';
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const input = Input.parse(await request.json().catch(() => ({})));
    const content = await db.contentItem.findFirst({
      where: { id, channel: { workspaceId: workspace.id } },
      include: { channel: true },
    });
    if (!content) return Response.json({ ok: false, error: 'Content not found' }, { status: 404 });
    if (!content.hook || !content.script) {
      return Response.json({ ok: false, error: 'Content must have a hook and script before rendering' }, { status: 409 });
    }

    const template = input.template ?? localTemplate(content.channel.templateId);
    const job = await createLocalRenderJob({
      topic: content.topic,
      hook: content.hook,
      script: content.script,
      caption: content.caption ?? undefined,
      voice: input.voice ?? content.channel.voice ?? 'en-us',
      speechRate: input.speechRate ?? 165,
      template,
    }, content.id, workspace.id);

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        workspaceId: workspace.id,
        status: job.status.toLowerCase(),
        finished: false,
        engine: 'local-ffmpeg',
        template,
      },
    }, { status: 202 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to render content locally';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
