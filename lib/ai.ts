import { demoIdea, normalizeIdea } from "./content";
import { isDemoMode, requiredEnv } from "./config";
import type { ContentIdea } from "./types";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM did not return a JSON object");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateContentIdea(niche = "science"): Promise<ContentIdea> {
  if (isDemoMode()) return demoIdea(niche);

  const apiKey = requiredEnv("LLM_API_KEY");
  const model = requiredEnv("LLM_MODEL");
  const endpoint = process.env.LLM_BASE_URL ?? "https://ai-gateway.vercel.sh/v1/chat/completions";
  const prompt = `Create one high-retention vertical short concept for the niche: ${niche}.\nReturn ONLY JSON with these keys: topic, hook, script, statNumber, statLabel, caption, hashtags, score.\nConstraints: script 70-115 words, hook <= 16 words, factual language, no invented citations, no unverifiable precise claims, score integer 0-100, hashtags array of 4-7 strings.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a short-form content strategist. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`LLM request failed (${response.status}): ${await response.text()}`);
  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM response did not contain message content");
  return normalizeIdea(extractJson(content) as Partial<ContentIdea>, niche);
}
