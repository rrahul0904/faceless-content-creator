import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { certifyVisualStory } from './qa';
import { VisualStorySpecSchema, type VisualStorySpec } from './schema';

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeRecord(record: {
  id: string;
  workspaceId: string;
  name: string;
  spec: Prisma.JsonValue;
  qa: Prisma.JsonValue | null;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...record,
    spec: VisualStorySpecSchema.parse(record.spec),
  };
}

export async function createVisualStory(input: { name?: string; spec: unknown }, workspaceId: string) {
  const spec = VisualStorySpecSchema.parse(input.spec);
  const qa = certifyVisualStory(spec);
  const name = String(input.name || spec.title).trim().slice(0, 160) || spec.title;

  const story = await db.$transaction(async (tx) => {
    const created = await tx.visualStory.create({
      data: {
        workspaceId,
        name,
        spec: asJson(spec),
        qa: asJson(qa),
        currentVersion: 1,
      },
    });
    await tx.visualStoryVersion.create({
      data: {
        visualStoryId: created.id,
        version: 1,
        spec: asJson(spec),
        qa: asJson(qa),
      },
    });
    return created;
  });

  return { ...serializeRecord(story), version: 1, qa };
}

export async function listVisualStories(workspaceId: string) {
  const stories = await db.visualStory.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
  return stories.map(serializeRecord);
}

export async function getVisualStory(id: string, workspaceId: string) {
  const story = await db.visualStory.findFirst({ where: { id, workspaceId } });
  return story ? serializeRecord(story) : null;
}

export async function updateVisualStory(id: string, input: { name?: string; spec: unknown }, workspaceId: string) {
  const spec = VisualStorySpecSchema.parse(input.spec);
  const qa = certifyVisualStory(spec);
  const current = await db.visualStory.findFirst({ where: { id, workspaceId } });
  if (!current) return null;
  const version = current.currentVersion + 1;
  const name = String(input.name || spec.title).trim().slice(0, 160) || spec.title;

  const updated = await db.$transaction(async (tx) => {
    const story = await tx.visualStory.update({
      where: { id },
      data: {
        name,
        spec: asJson(spec),
        qa: asJson(qa),
        currentVersion: version,
      },
    });
    await tx.visualStoryVersion.create({
      data: {
        visualStoryId: id,
        version,
        spec: asJson(spec),
        qa: asJson(qa),
      },
    });
    return story;
  });

  return { ...serializeRecord(updated), version, qa };
}

export async function deleteVisualStory(id: string, workspaceId: string) {
  const result = await db.visualStory.deleteMany({ where: { id, workspaceId } });
  return result.count === 1;
}

export async function listVisualStoryVersions(id: string, workspaceId: string) {
  const story = await db.visualStory.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!story) return null;
  const versions = await db.visualStoryVersion.findMany({
    where: { visualStoryId: id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, qa: true, createdAt: true },
  });
  return versions;
}

export async function getVisualStoryVersion(id: string, version: number, workspaceId: string) {
  const story = await db.visualStory.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!story) return null;
  const saved = await db.visualStoryVersion.findUnique({
    where: { visualStoryId_version: { visualStoryId: id, version } },
  });
  if (!saved) return null;
  return {
    ...saved,
    spec: VisualStorySpecSchema.parse(saved.spec),
  };
}

export async function restoreVisualStoryVersion(id: string, version: number, workspaceId: string) {
  const saved = await getVisualStoryVersion(id, version, workspaceId);
  if (!saved) return null;
  return updateVisualStory(id, { spec: saved.spec }, workspaceId);
}

export async function currentVisualStorySpec(id: string, workspaceId: string): Promise<{ spec: VisualStorySpec; version: number } | null> {
  const story = await getVisualStory(id, workspaceId);
  if (!story) return null;
  return { spec: story.spec, version: story.currentVersion };
}
