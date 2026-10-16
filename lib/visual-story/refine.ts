import { VisualStorySpecSchema, type VisualStorySpec } from './schema';

const FORMATS = ['process', 'roadmap', 'comparison', 'stats', 'architecture', 'listicle'] as const;
const MOTIONS = ['flow', 'build', 'pulse'] as const;
const SIZES = {
  portrait: [1080, 1350],
  square: [1080, 1080],
  landscape: [1200, 675],
} as const;

function clean(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseHex(instruction: string, label: string) {
  const match = instruction.match(new RegExp(`\\b${label}\\s+(?:color\\s+)?(?:to\\s+)?(#[0-9a-fA-F]{6})`, 'i'));
  return match?.[1];
}

function titleInstruction(instruction: string) {
  const explicit = instruction.match(/(?:^|[.;]\s*)(?:title|headline)\s*[:=]\s*["“]?([^"”\n]+)["”]?/i);
  if (explicit?.[1]) return clean(explicit[1], 160);
  const rename = instruction.match(/\b(?:rename|retitle)(?:\s+(?:this|it))?\s+to\s+["“]?([^"”\n]+)["”]?/i);
  return rename?.[1] ? clean(rename[1], 160) : null;
}

function compactText(value: string, max: number) {
  const text = clean(value, max);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function refineVisualStory(input: VisualStorySpec, rawInstruction: string) {
  const instruction = clean(rawInstruction, 1000);
  if (!instruction) throw new Error('REFINEMENT_INSTRUCTION_REQUIRED');

  const current = VisualStorySpecSchema.parse(input);
  const next: VisualStorySpec = JSON.parse(JSON.stringify(current)) as VisualStorySpec;
  const normalized = instruction.toLowerCase();
  const changes: string[] = [];

  const requestedTitle = titleInstruction(instruction);
  if (requestedTitle && requestedTitle !== next.title) {
    next.title = requestedTitle;
    changes.push('title');
  }

  for (const format of FORMATS) {
    if (new RegExp(`\\b(?:format|layout|style)(?:\\s+(?:to|as))?\\s+${format}\\b|\\b${format}\\s+(?:format|layout)\\b`, 'i').test(instruction) && next.format !== format) {
      next.format = format;
      changes.push(`format:${format}`);
      break;
    }
  }

  for (const motion of MOTIONS) {
    if (new RegExp(`\\b(?:motion|animation)(?:\\s+(?:to|as))?\\s+${motion}\\b|\\b${motion}\\s+(?:motion|animation)\\b`, 'i').test(instruction) && next.motion !== motion) {
      next.motion = motion;
      changes.push(`motion:${motion}`);
      break;
    }
  }

  for (const size of Object.keys(SIZES) as Array<keyof typeof SIZES>) {
    if (new RegExp(`\\b(?:canvas|size|aspect)(?:\\s+(?:to|as))?\\s+${size}\\b|\\b${size}\\s+(?:canvas|size|aspect)\\b`, 'i').test(instruction) && next.size !== size) {
      next.size = size;
      next.width = SIZES[size][0];
      next.height = SIZES[size][1];
      changes.push(`size:${size}`);
      break;
    }
  }

  const colorRequests: Array<[keyof VisualStorySpec['brand'], string]> = [
    ['primary', 'primary'],
    ['secondary', '(?:secondary|accent)'],
    ['background', 'background'],
    ['foreground', '(?:foreground|text)'],
  ];
  for (const [key, label] of colorRequests) {
    const value = parseHex(instruction, label);
    if (value && next.brand[key] !== value) {
      next.brand[key] = value;
      changes.push(`brand.${key}`);
    }
  }

  const removeItem = instruction.match(/\bremove\s+(?:item|step|card)\s+(\d+)\b/i);
  if (removeItem?.[1] && next.items.length > 1) {
    const index = Number(removeItem[1]) - 1;
    if (index >= 0 && index < next.items.length) {
      next.items.splice(index, 1);
      changes.push(`remove-item:${index + 1}`);
    }
  }

  const addItem = instruction.match(/\badd\s+(?:item|step|card)\s*:\s*([^|;\n]+)(?:\|([^|;\n]*))?(?:\|([^;\n]*))?/i);
  if (addItem?.[1] && next.items.length < 8) {
    const label = clean(addItem[1], 120);
    const detail = clean(addItem[2] || '', 280);
    const value = clean(addItem[3] || '', 40);
    next.items.push({
      id: `item-${Date.now()}-${next.items.length + 1}`,
      label,
      detail,
      ...(value ? { value } : {}),
    });
    changes.push('add-item');
  }

  if (/\b(?:remove|drop)\s+(?:all\s+)?details\b|\blabels\s+only\b/i.test(instruction)) {
    let changed = false;
    next.items = next.items.map((item) => {
      if (!item.detail) return item;
      changed = true;
      return { ...item, detail: '' };
    });
    if (changed) changes.push('remove-details');
  }

  if (/\b(?:more\s+concise|shorter|simplify|tighten|less\s+text|reduce\s+copy)\b/i.test(normalized)) {
    next.title = compactText(next.title, 96);
    next.subtitle = compactText(next.subtitle, 120);
    next.items = next.items.map((item) => ({
      ...item,
      label: compactText(item.label, 72),
      detail: compactText(item.detail, 110),
    }));
    changes.push('concise-copy');
  }

  if (!changes.length) {
    const error = new Error('REFINEMENT_NOT_UNDERSTOOD');
    (error as Error & { status?: number }).status = 422;
    throw error;
  }

  const refinements = [...(next.provenance.refinements ?? []), {
    mode: 'deterministic' as const,
    instruction,
    appliedAt: new Date().toISOString(),
    changes,
  }].slice(-20);
  next.provenance = { ...next.provenance, refinements };

  return { spec: VisualStorySpecSchema.parse(next), changes, instruction };
}
