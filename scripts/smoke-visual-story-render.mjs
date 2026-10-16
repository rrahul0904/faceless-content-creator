import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const db = new PrismaClient();

const spec = {
  version: '1.0',
  id: 'ci-visual-story',
  title: 'RAG systems need a retrieval contract',
  subtitle: 'A durable visual-story render exercises our owned spec, template engine and FFmpeg worker.',
  format: 'architecture',
  motion: 'flow',
  size: 'portrait',
  width: 1080,
  height: 1350,
  brand: {
    name: 'Creator Studio',
    handle: '@creator',
    primary: '#6D5EF9',
    secondary: '#20C7A8',
    background: '#0B1020',
    foreground: '#F7F8FC',
  },
  items: [
    { id: 'item-1', label: 'Ingest documents', detail: 'Capture source material and provenance.' },
    { id: 'item-2', label: 'Chunk and embed', detail: 'Create retrievable semantic units.' },
    { id: 'item-3', label: 'Retrieve context', detail: 'Select evidence for the current request.' },
    { id: 'item-4', label: 'Generate grounded answer', detail: 'Keep claims connected to retrieved evidence.' },
  ],
  sourcePrompt: 'RAG pipeline: ingest -> chunk -> embed -> retrieve -> answer',
  provenance: {
    mode: 'deterministic',
    claimsPolicy: 'source-only',
    generatedAt: new Date().toISOString(),
  },
};

try {
  const job = await db.renderJob.create({
    data: {
      status: 'QUEUED',
      input: { kind: 'visual-story-v1', output: 'gif', spec },
    },
  });

  await execFileAsync(process.execPath, ['worker/render-job.mjs', job.id], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 96,
    timeout: 180000,
  });

  const completed = await db.renderJob.findUnique({ where: { id: job.id } });
  if (!completed || completed.status !== 'SUCCEEDED' || !completed.outputFile || !completed.videoUrl) {
    throw new Error(`Visual story worker did not complete successfully: ${JSON.stringify(completed)}`);
  }
  if (!completed.outputFile.endsWith('.gif') || !completed.videoUrl.endsWith('.gif')) {
    throw new Error(`Visual story worker returned the wrong artifact type: ${completed.outputFile}`);
  }

  const file = await stat(completed.outputFile);
  const bytes = await readFile(completed.outputFile);
  if (!file.isFile() || file.size < 10_000 || bytes.subarray(0, 6).toString('ascii') !== 'GIF89a') {
    throw new Error('Visual story worker did not produce a valid GIF artifact');
  }

  console.log(JSON.stringify({
    ok: true,
    jobId: completed.id,
    status: completed.status,
    outputFile: completed.outputFile,
    artifactUrl: completed.videoUrl,
    bytes: file.size,
  }));
} finally {
  await db.$disconnect();
}
