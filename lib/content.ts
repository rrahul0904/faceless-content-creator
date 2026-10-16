import { z } from 'zod';

const ScriptResult = z.object({
  topic: z.string(),
  hook: z.string(),
  script: z.string(),
  caption: z.string(),
  statNumber: z.string().optional(),
  statLabel: z.string().optional(),
});

export type ScriptResult = z.infer<typeof ScriptResult>;

type ScriptInput = {
  niche: string;
  idea: string;
  audience?: string;
  mode?: 'educational' | 'character';
  creativeContext?: string;
};

export async function generateScript(input: ScriptInput): Promise<ScriptResult> {
  const endpoint = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  const mode = input.mode ?? 'educational';

  if (!endpoint || !apiKey || !model) {
    const topic = input.idea.trim();
    if (mode === 'character') {
      const identity = input.creativeContext?.trim() || 'Keep the recurring character visually and behaviorally consistent.';
      return {
        topic,
        hook: `The familiar character is back — but this time the situation changes fast.`,
        script: `${identity} Open directly on the recurring behavior, introduce the new situation in one beat, escalate once, land a visual payoff, and finish on a loopable callback that makes the next episode feel inevitable.`,
        caption: `${topic} — same character, new twist. Follow for the next episode. #aicharacter #shortformvideo`,
      };
    }

    return {
      topic,
      hook: `The part of ${topic} almost everyone misses.`,
      script: `Here is the simple version. ${topic} matters because small changes compound quickly. Start with the core idea, remove the jargon, show one concrete example, and end with the implication your audience can use today.`,
      caption: `${topic} — explained without the fluff. #shorts #facelesscontent`,
    };
  }

  const systemPrompt = mode === 'character'
    ? 'You are a short-form fictional skit producer. Return JSON only with topic, hook, script and caption. Preserve the recurring character identity and recurring bit in the supplied creative context. Write a 15-35 second scene with an immediate visual hook, one escalation, a clear payoff and a loopable ending. Never invent performance or earnings claims. If an offer is supplied, integrate it only when it fits naturally after the payoff.'
    : 'You are a short-form video producer. Return JSON only with topic, hook, script, caption, optional statNumber and statLabel. Scripts must be factual, concise, 25-45 seconds spoken, and avoid invented statistics.';

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            `Niche: ${input.niche}`,
            `Idea: ${input.idea}`,
            `Audience: ${input.audience ?? 'general curious audience'}`,
            input.creativeContext ? `Creative context: ${input.creativeContext}` : '',
          ].filter(Boolean).join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned no content');
  return ScriptResult.parse(JSON.parse(content));
}
