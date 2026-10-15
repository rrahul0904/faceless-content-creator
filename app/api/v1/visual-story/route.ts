import { NextResponse } from 'next/server';
import { planVisualStory } from '@/lib/visual-story/planner';
import { VisualStoryRequestSchema } from '@/lib/visual-story/types';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = VisualStoryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid visual story request.', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const story = await planVisualStory(parsed.data);
    return NextResponse.json({ story });
  } catch (error) {
    console.error('visual-story generation failed', error);
    return NextResponse.json({ error: 'Unable to generate the visual story.' }, { status: 500 });
  }
}
