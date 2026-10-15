import { randomUUID } from 'node:crypto';
import {
  MotionModeSchema,
  VisualStoryBrandSchema,
  VisualStoryFormatSchema,
  VisualStorySpecSchema,
  type VisualStoryBrand,
  type VisualStoryFormat,
  type VisualStoryItem,
  type VisualStoryRequest,
  type VisualStorySize,
  type VisualStorySpec,
} from './types';

const DIMENSIONS: Record<VisualStorySize, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 675 },
};

const defaultBrand: VisualStoryBrand = VisualStoryBrandSchema.parse({});

function inferFormat(prompt: string): VisualStoryFormat {
  const value = prompt.toLowerCase();
  if (/\b(vs\.?|versus|compare|comparison|before\s+and\s+after)\b/.test(value)) return 'comparison';
  if (/\b(roadmap|timeline|milestone|quarter|phase)\b/.test(value)) return 'roadmap';
  if (/\b(architecture|system|pipeline|service|database|api|queue|kafka|warehouse|lakehouse)\b/.test(value)) return 'architecture';
  if (/\b(stat|metric|kpi|percent|percentage)\b/.test(value) || /\b\d+(?:\.\d+)?%\b/.test(value)) return 'stats';
  if (/\b(top\s+\d+|list|checklist|tips|ways|rules|lessons)\b/.test(value)) return 'listicle';
  return 'process';
}

function cleanSegment(value: string): string {
  return value
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractValue(segment: string): string | undefined {
  const match = segment.match(/(?:^|\s)([$€£]?\d[\d,.]*\s?(?:%|x|k|m|b|ms|s|sec|min|hrs?)?)(?:\s|$)/i);
  return match?.[1]?.trim();
}

function deterministicItems(prompt: string): VisualStoryItem[] {
  const colonIndex = prompt.indexOf(':');
  const body = colonIndex >= 0 ? prompt.slice(colonIndex + 1) : prompt;
  let parts = body
    .split(/\s*(?:→|->|=>|\|>|;|\n|\r\n)\s*/g)
    .map(cleanSegment)
    .filter(Boolean);

  if (parts.length < 2) {
    const bullets = body
      .split(/\s+[•*-]\s+|\.\s+(?=[A-Z0-9])/g)
      .map(cleanSegment)
      .filter(Boolean);
    if (bullets.length > 1) parts = bullets;
  }

  if (parts.length === 0) parts = [cleanSegment(prompt)];
  parts = parts.slice(0, 8);

  return parts.map((part, index) => {
    const value = extractValue(part);
    const labelSource = value ? part.replace(value, '').replace(/^[:\-\s]+|[:\-\s]+$/g, '') : part;
    const label = (labelSource || part).slice(0, 96);
    const detail = part.length > label.length ? part.slice(label.length).trim() : '';
    return { id: `item-${index + 1}`, label, detail, ...(value ? { value } : {}) };
  });
}

function deterministicTitle(prompt: string): string {
  const firstLine = prompt.split(/\r?\n/)[0]?.trim() || 'Visual story';
  const colonIndex = firstLine.indexOf(':');
  const title = colonIndex > 8 ? firstLine.slice(0, colonIndex) : firstLine;
  return title.replace(/[.;,\s]+$/, '').slice(0, 150) || 'Visual story';
}

async function planWithConfiguredLlm(input: VisualStoryRequest): Promise<Pick<VisualStorySpec, 'title' | 'subtitle' | 'format' | 'motion' | 'items'> | null> {
  const endpoint = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!endpoint || !apiKey || !model) return null;

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are a visual-story planner. Return JSON only.',
            'Never invent statistics, product states, named customers, benchmarks, quotes, or claims not present in the user prompt.',
            'Compress the supplied information into 1-8 visual items. Prefer a short, concrete title and subtitle.',
            'Allowed formats: process, roadmap, comparison, stats, architecture, listicle.',
            'Allowed motion: flow, build, pulse.',
            'Return exactly: {title, subtitle, format, motion, items:[{id,label,detail,value?}]}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Prompt: ${input.prompt}\nPreferred format: ${input.format ?? 'auto'}\nPreferred motion: ${input.motion}`,
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const format = input.format ?? VisualStoryFormatSchema.parse(parsed.format);
    const motion = input.motion ?? MotionModeSchema.parse(parsed.motion);
    const items = Array.isArray(parsed.items)
      ? parsed.items.slice(0, 8).map((raw, index) => {
          const item = raw as Record<string, unknown>;
          return {
            id: typeof item.id === 'string' && item.id ? item.id : `item-${index + 1}`,
            label: String(item.label ?? '').slice(0, 120),
            detail: String(item.detail ?? '').slice(0, 280),
            ...(item.value ? { value: String(item.value).slice(0, 40) } : {}),
          };
        }).filter((item) => item.label)
      : [];

    if (!items.length) return null;
    return {
      title: String(parsed.title ?? deterministicTitle(input.prompt)).slice(0, 160),
      subtitle: String(parsed.subtitle ?? '').slice(0, 220),
      format,
      motion,
      items,
    };
  } catch {
    return null;
  }
}

export async function planVisualStory(input: VisualStoryRequest): Promise<VisualStorySpec> {
  const brand = VisualStoryBrandSchema.parse({ ...defaultBrand, ...(input.brand ?? {}) });
  const llmPlan = await planWithConfiguredLlm(input);
  const format = input.format ?? llmPlan?.format ?? inferFormat(input.prompt);
  const motion = input.motion ?? llmPlan?.motion ?? 'flow';
  const items = llmPlan?.items ?? deterministicItems(input.prompt);
  const dimensions = DIMENSIONS[input.size];

  return VisualStorySpecSchema.parse({
    version: '1.0',
    id: randomUUID(),
    title: llmPlan?.title ?? deterministicTitle(input.prompt),
    subtitle: llmPlan?.subtitle ?? (items.length > 1 ? `${items.length} connected ideas` : 'Source-grounded visual story'),
    format,
    motion,
    size: input.size,
    ...dimensions,
    brand,
    items,
    sourcePrompt: input.prompt,
    provenance: {
      mode: llmPlan ? 'llm' : 'deterministic',
      claimsPolicy: 'source-only',
      generatedAt: new Date().toISOString(),
    },
  });
}
