import { z } from 'zod';
import { createPresenter } from '@/lib/orshot';

const PresenterRequest = z.object({
  script: z.string().min(1),
  imageRef: z.string().url().optional(),
  voice: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = PresenterRequest.parse(await request.json());
    const imageRef = payload.imageRef ?? process.env.ORSHOT_PRESENTER_IMAGE;
    const voice = payload.voice ?? process.env.ORSHOT_VOICE_ID;
    if (!imageRef || !voice) {
      return Response.json({
        ok: false,
        error: 'Configure ORSHOT_PRESENTER_IMAGE and ORSHOT_VOICE_ID, or send imageRef and voice in the request.',
      }, { status: 400 });
    }
    const presenter = await createPresenter({ imageRef, voice, script: payload.script });
    return Response.json({ ok: true, presenter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate presenter';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
