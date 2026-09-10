import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { startRenderWorker } from '@/lib/render-worker';

export type AIVideoRequest = {
  imageRef: string;
  script: string;
  voice?: string;
  consent: true;
  aspect?: '9:16' | '1:1' | '16:9';
  provider?: 'musetalk';
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizePresenterRef(imageRef: string) {
  if (imageRef.startsWith('/api/media/')) {
    const filename = decodeURIComponent(imageRef.slice('/api/media/'.length));
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error('Presenter media reference is invalid');
    return `/shared/uploads/${filename}`;
  }
  return imageRef;
}

export async function queueAIVideo(input: AIVideoRequest) {
  const job = await db.renderJob.create({
    data: {
      status: 'QUEUED',
      input: asJson({
        kind: 'ai-video-v1',
        provider: input.provider ?? 'musetalk',
        imageRef: normalizePresenterRef(input.imageRef),
        script: input.script,
        voice: input.voice ?? 'af_heart',
        consent: input.consent,
        aspect: input.aspect ?? '9:16',
      }),
    },
  });
  startRenderWorker(job.id);
  return job;
}
