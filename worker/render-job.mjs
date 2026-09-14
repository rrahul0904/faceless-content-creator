import { unlink } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { renderAIVideo } from './ai-video.mjs';
import { renderFacelessVideo } from './local-renderer.mjs';
import { renderTemplateVideo } from './template-renderer.mjs';

const db = new PrismaClient();
const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: node worker/render-job.mjs <job-id>');
  process.exit(2);
}

async function returnContentToScripted() {
  const content = await db.contentItem.findFirst({ where: { renderJobId: jobId } });
  if (content) {
    await db.contentItem.update({ where: { id: content.id }, data: { status: 'SCRIPTED' } });
  }
}

async function discardOutput(result) {
  if (!result?.outputFile) return;
  try {
    await unlink(result.outputFile);
  } catch {
    // Cancellation remains authoritative even when an already-written artifact cannot be removed.
  }
}

try {
  const job = await db.renderJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Render job ${jobId} was not found`);

  if (job.status === 'CANCELLED' || job.cancelRequested) {
    await db.renderJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', cancelRequested: true, finishedAt: job.finishedAt ?? new Date() },
    });
    await returnContentToScripted();
    console.log(JSON.stringify({ ok: true, jobId, cancelled: true, phase: 'before-start' }));
    process.exitCode = 0;
  } else if (job.status !== 'QUEUED') {
    console.log(JSON.stringify({ ok: true, jobId, skipped: true, status: job.status.toLowerCase() }));
    process.exitCode = 0;
  } else {
    const claimed = await db.renderJob.updateMany({
      where: { id: jobId, status: 'QUEUED', cancelRequested: false },
      data: { status: 'RUNNING', startedAt: new Date(), error: null },
    });

    if (claimed.count !== 1) {
      const current = await db.renderJob.findUnique({ where: { id: jobId } });
      console.log(JSON.stringify({ ok: true, jobId, skipped: true, status: current?.status.toLowerCase() ?? 'unknown' }));
      process.exitCode = 0;
    } else {
      const input = job.input;
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Render job input is invalid');
      }

      let result;
      if (input.kind === 'template-v1') {
        if (!input.document || typeof input.document !== 'object' || Array.isArray(input.document)) {
          throw new Error('Template render job document is invalid');
        }
        result = await renderTemplateVideo({
          jobId,
          document: input.document,
          response: input.response && typeof input.response === 'object' && !Array.isArray(input.response) ? input.response : {},
        });
      } else if (input.kind === 'ai-video-v1') {
        result = await renderAIVideo({ jobId, input });
      } else {
        result = await renderFacelessVideo({
          jobId,
          topic: String(input.topic ?? 'FACELESS'),
          hook: String(input.hook ?? ''),
          script: String(input.script ?? ''),
          voice: String(input.voice ?? 'en-us'),
          speechRate: Number(input.speechRate ?? 165),
          template: String(input.template ?? 'editorial'),
        });
      }

      const current = await db.renderJob.findUnique({
        where: { id: jobId },
        select: { status: true, cancelRequested: true },
      });

      if (!current || current.status === 'CANCELLED' || current.cancelRequested) {
        await discardOutput(result);
        await db.renderJob.update({
          where: { id: jobId },
          data: {
            status: 'CANCELLED',
            cancelRequested: true,
            outputFile: null,
            videoUrl: null,
            error: null,
            finishedAt: new Date(),
          },
        });
        await returnContentToScripted();
        console.log(JSON.stringify({ ok: true, jobId, cancelled: true, phase: 'after-render' }));
      } else {
        await db.$transaction(async (tx) => {
          await tx.renderJob.update({
            where: { id: jobId },
            data: {
              status: 'SUCCEEDED',
              outputFile: result.outputFile,
              videoUrl: result.videoUrl,
              finishedAt: new Date(),
            },
          });

          const content = await tx.contentItem.findFirst({ where: { renderJobId: jobId } });
          if (content) {
            await tx.contentItem.update({
              where: { id: content.id },
              data: { status: 'REVIEW', videoUrl: result.videoUrl },
            });
          }
        });

        console.log(JSON.stringify({ ok: true, jobId, ...result }));
      }
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const current = await db.renderJob.findUnique({
      where: { id: jobId },
      select: { status: true, cancelRequested: true },
    });
    if (current?.status === 'CANCELLED' || current?.cancelRequested) {
      await db.renderJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', cancelRequested: true, error: null, finishedAt: new Date() },
      });
      await returnContentToScripted();
    } else {
      await db.renderJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message, finishedAt: new Date() },
      });
      const content = await db.contentItem.findFirst({ where: { renderJobId: jobId } });
      if (content) {
        await db.contentItem.update({ where: { id: content.id }, data: { status: 'FAILED' } });
      }
    }
  } catch {
    // Preserve the original renderer failure if persistence also failed.
  }
  console.error(message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
