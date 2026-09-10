import type { ContentIdea } from "./types";

const demoIdeas: Record<string, Omit<ContentIdea, "id" | "niche">> = {
  ai: {
    topic: "AI IN REAL LIFE",
    hook: "AI agents are starting to use software like employees do.",
    script: "AI agents are moving beyond chat boxes. They can now navigate software, call tools, inspect files, and complete multi-step work. The shift is simple: instead of asking AI for an answer, you give it an outcome and let it work through the steps.",
    statNumber: "4",
    statLabel: "CAPABILITIES",
    caption: "AI is moving from answers to actions. Here is the shift to watch.",
    hashtags: ["#AI", "#AIAgents", "#Automation", "#Tech"],
    score: 92
  },
  default: {
    topic: "SCIENCE IN 30 SECONDS",
    hook: "A day on Venus is longer than a year on Venus.",
    script: "Venus rotates so slowly that one full spin takes about 243 Earth days. But it circles the Sun in about 225 Earth days. That means a Venusian day is actually longer than a Venusian year.",
    statNumber: "243",
    statLabel: "EARTH DAYS",
    caption: "Space is full of facts that sound made up. This one is real.",
    hashtags: ["#Science", "#Space", "#Facts", "#Shorts"],
    score: 89
  }
};

export function demoIdea(niche = "science"): ContentIdea {
  const normalized = niche.toLowerCase();
  const base = normalized.includes("ai") ? demoIdeas.ai : demoIdeas.default;
  return { ...base, id: `idea_${crypto.randomUUID()}`, niche };
}

export function normalizeIdea(input: Partial<ContentIdea>, niche: string): ContentIdea {
  const fallback = demoIdea(niche);
  return {
    id: input.id ?? `idea_${crypto.randomUUID()}`,
    topic: String(input.topic ?? fallback.topic).slice(0, 80),
    hook: String(input.hook ?? fallback.hook).slice(0, 180),
    script: String(input.script ?? fallback.script).slice(0, 1400),
    statNumber: String(input.statNumber ?? fallback.statNumber).slice(0, 24),
    statLabel: String(input.statLabel ?? fallback.statLabel).slice(0, 48),
    caption: String(input.caption ?? fallback.caption).slice(0, 500),
    hashtags: Array.isArray(input.hashtags) ? input.hashtags.map(String).slice(0, 10) : fallback.hashtags,
    score: Math.max(0, Math.min(100, Number(input.score ?? fallback.score))),
    niche
  };
}
