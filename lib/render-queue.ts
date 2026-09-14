import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { startRenderWorker } from '@/lib/render-worker';

export type LocalTemplate = 'editorial' | 'signal' | 'ember';

export type LocalRenderInput = {
  hook: string;
  script: string;
  topic: string;
  caption?: string;
  voice?: string;
  speechRate?: number;
  template?: LocalTemplate;
};

export async function createLocalRenderJob(input: LocalRenderInput, contentId?: string, workspaceId?: string) {
  let content: { id: string; channel: { workspaceId: string | null } } | null = null;
  if (contentId) {
    content = await db.contentItem.findUnique({
      where: { id: contentId },
      select: { id: true, channel: { select: { workspaceId: true } } },
    });
    if (!content) throw new Error('Content item not found');
    if (workspaceId && content.channel.workspaceId && content.channel.workspaceId !== workspaceId) {
      throw new Error('Content item belongs to a different workspace');
    }
  }

  const renderInput = {
    kind: 'legacy-local',
    hook: input.hook,
    script: input.script,
    topic: input.topic,
    caption: input.caption ?? '',
    voice: input.voice ?? 'en-us',
    speechRate: input.speechRate ?? 165,
    template: input.template ?? 'editorial',
  } satisfies Prisma.InputJsonObject;

  const job = await db.renderJob.create({
    data: { workspaceId, input: renderInput, status: 'QUEUED' },
  });

  if (content) {
    await db.contentItem.update({
      where: { id: content.id },
      data: { renderJobId: job.id, status: 'RENDERING' },
    });
  }

  startRenderWorker(job.id);
  return job;
}
