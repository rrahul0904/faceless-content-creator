import { z } from 'zod';
import { generateScript } from '@/lib/content';

const ScriptRequest = z.object({
  niche: z.string().min(1),
  idea: z.string().min(1),
  audience: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = ScriptRequest.parse(await request.json());
    const result = await generateScript(payload);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate script';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
