import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const db = new PrismaClient();

try {
  const job = await db.renderJob.create({
    data: {
      status: 'QUEUED',
      input: {
        hook: 'Zero-config render engine',
        topic: 'Local rendering',
        script: 'This short video was generated locally using SQLite, text to speech, and FFmpeg. No rendering API key was required.',
        caption: 'Generated locally.',
        voice: 'en-us',
        speechRate: 170,
      },
    },
  });

  await execFileAsync(process.execPath, ['worker/render-job.mjs', job.id], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 32,
    timeout: 120000,
  });

  const completed = await db.renderJob.findUnique({ where: { id: job.id } });
  if (!completed || completed.status !== 'SUCCEEDED' || !completed.outputFile || !completed.videoUrl) {
    throw new Error(`Worker did not complete successfully: ${JSON.stringify(completed)}`);
  }

  const file = await stat(completed.outputFile);
  if (!file.isFile() || file.size < 10_000) {
    throw new Error('Worker did not produce a valid MP4 file');
  }

  console.log(JSON.stringify({
    ok: true,
    jobId: completed.id,
    status: completed.status,
    outputFile: completed.outputFile,
    videoUrl: completed.videoUrl,
    bytes: file.size,
  }));
} finally {
  await db.$disconnect();
}
