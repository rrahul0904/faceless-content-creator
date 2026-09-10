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

export async function generateScript(input: { niche: string; idea: string; audience?: string }): Promise<ScriptResult> {
  const endpoint = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!endpoint || !apiKey || !model) {
    const topic = input.idea.trim();
    return {
      topic,
      hook: `The part of ${topic} almost everyone misses.`,
      script: `Here is the simple version. ${topic} matters because small changes compound quickly. Start with the core idea, remove the jargon, show one concrete example, and end with the implication your audience can use today.`,
      caption: `${topic} — explained without the fluff. #shorts #facelesscontent`,
    };
  }

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
          content: 'You are a short-form video producer. Return JSON only with topic, hook, script, caption, optional statNumber and statLabel. Scripts must be factual, concise, 25-45 seconds spoken, and avoid invented statistics.',
        },
        {
          role: 'user',
          content: `Niche: ${input.niche}\nIdea: ${input.idea}\nAudience: ${input.audience ?? 'general curious audience'}`,
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
