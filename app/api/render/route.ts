import { z } from 'zod';
import { startRender } from '@/lib/orshot';

const RenderRequest = z.object({
  hook: z.string().min(1),
  script: z.string().min(1),
  topic: z.string().min(1),
  statNumber: z.string().optional(),
  statLabel: z.string().optional(),
  handle: z.string().optional(),
  clipUrl: z.string().url().optional(),
  metadata: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = RenderRequest.parse(await request.json());
    const job = await startRender(payload);
    return Response.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start render';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
