import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { extractModifications, modificationsJson } from './modifications';
import { TemplateDocumentSchema, type TemplateDocument } from './schema';

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function serializeTemplate(template: TemplateDocument) {
  return {
    ...template,
    modifications: extractModifications(template),
    modificationsJson: modificationsJson(template),
  };
}

export async function createTemplate(input: unknown, workspaceId?: string) {
  const parsed = TemplateDocumentSchema.parse(input);
  const template = await db.template.create({
    data: {
      workspaceId,
      name: parsed.name,
      description: parsed.description,
      tags: asJson(parsed.tags),
      schemaVersion: parsed.schemaVersion,
      canvasWidth: parsed.canvasWidth,
      canvasHeight: parsed.canvasHeight,
      document: asJson(parsed),
    },
  });

  await db.templateVersion.create({
    data: { templateId: template.id, version: 1, document: asJson(parsed) },
  });

  return { ...template, document: serializeTemplate(parsed), version: 1 };
}

export async function listTemplates(workspaceId?: string) {
  const templates = await db.template.findMany({
    where: workspaceId ? { workspaceId } : undefined,
    orderBy: { updatedAt: 'desc' },
  });

  return templates.map((template) => {
    const parsed = TemplateDocumentSchema.parse(template.document);
    return { ...template, document: serializeTemplate(parsed) };
  });
}

export async function getTemplate(id: string) {
  const template = await db.template.findUnique({ where: { id } });
  if (!template) return null;
  const latestVersion = await db.templateVersion.findFirst({
    where: { templateId: id },
    orderBy: { version: 'desc' },
  });
  const parsed = TemplateDocumentSchema.parse(template.document);
  return { ...template, document: serializeTemplate(parsed), version: latestVersion?.version ?? 1 };
}

export async function updateTemplate(id: string, input: unknown) {
  const parsed = TemplateDocumentSchema.parse(input);
  const current = await db.template.findUnique({ where: { id } });
  if (!current) return null;
  const latestVersion = await db.templateVersion.findFirst({
    where: { templateId: id },
    orderBy: { version: 'desc' },
  });
  const version = (latestVersion?.version ?? 0) + 1;

  const template = await db.$transaction(async (tx) => {
    const updated = await tx.template.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description,
        tags: asJson(parsed.tags),
        schemaVersion: parsed.schemaVersion,
        canvasWidth: parsed.canvasWidth,
        canvasHeight: parsed.canvasHeight,
        document: asJson(parsed),
      },
    });
    await tx.templateVersion.create({
      data: { templateId: id, version, document: asJson(parsed) },
    });
    return updated;
  });

  return { ...template, document: serializeTemplate(parsed), version };
}

export async function deleteTemplate(id: string) {
  try {
    await db.template.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
