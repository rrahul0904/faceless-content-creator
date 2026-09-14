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

export async function createLocalRenderJob(input: LocalRenderInput, contentId?: string) {
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
    data: { input: renderInput, status: 'QUEUED' },
  });

  if (contentId) {
    await db.contentItem.update({
      where: { id: contentId },
      data: { renderJobId: job.id, status: 'RENDERING' },
    });
  }

  startRenderWorker(job.id);
  return job;
}
