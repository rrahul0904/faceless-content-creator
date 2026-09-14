import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const PatchInput = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().nullable().optional(),
  localPath: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = await db.brandAsset.findUnique({ where: { id } });
  if (!asset) return Response.json({ ok: false, error: 'Brand asset not found' }, { status: 404 });
  return Response.json({ ok: true, data: asset });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = PatchInput.parse(await request.json());
    const existing = await db.brandAsset.findUnique({ where: { id } });
    if (!existing) return Response.json({ ok: false, error: 'Brand asset not found' }, { status: 404 });
    const asset = await db.brandAsset.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.localPath !== undefined ? { localPath: input.localPath } : {}),
        ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.tags !== undefined ? { tags: jsonValue(input.tags) } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata === null ? Prisma.JsonNull : jsonValue(input.metadata) } : {}),
      },
    });
    return Response.json({ ok: true, data: asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update brand asset';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await db.brandAsset.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'Brand asset not found' }, { status: 404 });
  }
}
