import { z } from 'zod';
import { discoverVisuals } from '@/lib/visuals';

const Input = z.object({ script: z.string().min(1).max(12_000) });

export async function POST(request: Request) {
  try {
    const { script } = Input.parse(await request.json());
    const visuals = await discoverVisuals(script);
    return Response.json({ ok: true, visuals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to discover visuals';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
