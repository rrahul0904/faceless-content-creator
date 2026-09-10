import { spawn } from 'node:child_process';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const RenderRequest = z.object({
  hook: z.string().min(1).max(280),
  script: z.string().min(1).max(6000),
  topic: z.string().min(1).max(500),
  caption: z.string().max(2200).optional(),
  voice: z.enum(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']).default('en-us'),
  speechRate: z.number().int().min(110).max(230).default(165),
  contentId: z.string().cuid().optional(),
});

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

export async function POST(request: Request) {
  try {
    const payload = RenderRequest.parse(await request.json());
    const input = {
      hook: payload.hook,
      script: payload.script,
      topic: payload.topic,
      caption: payload.caption ?? '',
      voice: payload.voice,
      speechRate: payload.speechRate,
    } satisfies Prisma.InputJsonObject;

    const job = await db.renderJob.create({
      data: { input, status: 'QUEUED' },
    });

    if (payload.contentId) {
      await db.contentItem.update({
        where: { id: payload.contentId },
        data: { renderJobId: job.id, status: 'RENDERING' },
      });
    }

    startDetachedWorker(job.id);

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        finished: false,
        engine: 'local-ffmpeg',
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start local render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
