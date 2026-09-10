import { z } from 'zod';
import { db } from '@/lib/db';

const ChannelInput = z.object({
  name: z.string().min(1),
  niche: z.string().min(1),
  handle: z.string().optional(),
  voice: z.string().optional(),
  templateId: z.string().optional(),
});

export async function GET() {
  const channels = await db.channel.findMany({ orderBy: { createdAt: 'desc' } });
  return Response.json({ ok: true, channels });
}

export async function POST(request: Request) {
  try {
    const payload = ChannelInput.parse(await request.json());
    const channel = await db.channel.create({ data: payload });
    return Response.json({ ok: true, channel }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create channel';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
