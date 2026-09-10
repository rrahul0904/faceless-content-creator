import { z } from 'zod';
import { queueAIVideo } from '@/lib/ai-video';

export const runtime = 'nodejs';

const Input = z.object({
  imageRef: z.string().min(1),
  script: z.string().min(1).max(12000),
  voice: z.string().min(1).max(128).default('af_heart'),
  consent: z.literal(true),
  aspect: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  provider: z.literal('musetalk').default('musetalk'),
});

export async function POST(request: Request) {
  try {
    const payload = Input.parse(await request.json());
    const job = await queueAIVideo(payload);
    return Response.json({
      ok: true,
      data: {
        id: job.id,
        jobId: job.id,
        status: job.status.toLowerCase(),
        mode: 'async',
        provider: payload.provider,
      },
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to queue AI video';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
