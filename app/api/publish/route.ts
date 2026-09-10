import { z } from 'zod';
import { publishVideo } from '@/lib/orshot';

const PublishRequest = z.object({
  videoUrl: z.string().url(),
  caption: z.string().min(1),
  accountIds: z.array(z.number().int().positive()).min(1),
  scheduledFor: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = PublishRequest.parse(await request.json());
    const result = await publishVideo(payload);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish video';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
