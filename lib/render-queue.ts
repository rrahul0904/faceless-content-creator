import { spawn } from 'node:child_process';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type LocalRenderInput = {
  hook: string;
  script: string;
  topic: string;
  caption?: string;
  voice?: string;
  speechRate?: number;
};

function startDetachedWorker(jobId: string) {
  const workerPath = path.join(process.cwd(), 'worker', 'render-job.mjs');
  const child = spawn(process.execPath, [workerPath, jobId], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
}

export async function createLocalRenderJob(input: LocalRenderInput, contentId?: string) {
  const renderInput = {
    hook: input.hook,
    script: input.script,
    topic: input.topic,
    caption: input.caption ?? '',
    voice: input.voice ?? 'en-us',
    speechRate: input.speechRate ?? 165,
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

  startDetachedWorker(job.id);
  return job;
}
