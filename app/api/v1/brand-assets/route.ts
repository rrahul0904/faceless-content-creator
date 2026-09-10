import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const AssetInput = z.object({
  workspaceId: z.string().optional(),
  type: z.enum(['IMAGE', 'COLOR', 'FONT', 'VIDEO', 'AUDIO']),
  name: z.string().min(1).max(255),
  url: z.string().optional(),
  localPath: z.string().optional(),
  mimeType: z.string().optional(),
  value: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId') || undefined;
  const type = url.searchParams.get('type') || undefined;
  const query = url.searchParams.get('q')?.trim() || undefined;
  const assets = await db.brandAsset.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(type && ['IMAGE','COLOR','FONT','VIDEO','AUDIO'].includes(type) ? { type: type as 'IMAGE'|'COLOR'|'FONT'|'VIDEO'|'AUDIO' } : {}),
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return Response.json({ ok: true, data: assets });
}

export async function POST(request: Request) {
  try {
    const input = AssetInput.parse(await request.json());
    if (input.type === 'COLOR' && !input.value) {
      return Response.json({ ok: false, error: 'Color assets require a value' }, { status: 400 });
    }
    if (input.type !== 'COLOR' && !input.url && !input.localPath && !input.value) {
      return Response.json({ ok: false, error: 'Media assets require a URL, local path or value' }, { status: 400 });
    }
    const asset = await db.brandAsset.create({
      data: {
        workspaceId: input.workspaceId,
        type: input.type,
        name: input.name,
        url: input.url,
        localPath: input.localPath,
        mimeType: input.mimeType,
        value: input.value,
        tags: jsonValue(input.tags),
        metadata: input.metadata ? jsonValue(input.metadata) : undefined,
      },
    });
    return Response.json({ ok: true, data: asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create brand asset';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
