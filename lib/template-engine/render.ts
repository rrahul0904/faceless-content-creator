import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { startRenderWorker } from '@/lib/render-worker';
import { applyModifications } from './modifications';
import { resizeTemplate } from './resize';
import { TemplateDocumentSchema } from './schema';

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type TemplateRenderRequest = {
  modifications?: Record<string, unknown>;
  response?: {
    format?: 'mp4';
    mode?: 'async';
    size?: { width: number; height: number };
  };
};

export async function queueTemplateRender(templateId: string, request: TemplateRenderRequest) {
  const stored = await db.template.findUnique({ where: { id: templateId } });
  if (!stored) return null;

  const parsed = TemplateDocumentSchema.parse(stored.document);
  const modified = applyModifications(parsed, request.modifications ?? {});
  const requestedSize = request.response?.size;
  const document = requestedSize ? resizeTemplate(modified.document, requestedSize) : modified.document;

  const input = {
    kind: 'template-v1',
    templateId,
    document,
    modifications: request.modifications ?? {},
    warnings: modified.warnings,
    response: {
      format: request.response?.format ?? 'mp4',
      mode: 'async',
      size: requestedSize ?? null,
    },
  };

  const job = await db.renderJob.create({
    data: {
      templateId,
      status: 'QUEUED',
      input: asJson(input),
    },
  });

  startRenderWorker(job.id);
  return { job, warnings: modified.warnings };
}
