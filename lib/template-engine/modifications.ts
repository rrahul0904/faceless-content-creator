import type { TemplateDocument, TemplateElement, TemplatePage } from './schema';

export type ModificationType = 'text' | 'voiceText' | 'imageUrl' | 'videoUrl' | 'backgroundColor' | 'fill' | 'color' | 'stroke';

export type TemplateModification = {
  key: string;
  id: string;
  type: ModificationType;
  description: string;
  helpText: string;
  example: string;
  elementId?: string;
  elementName?: string;
  elementType?: string;
  pageNumber: number;
  pageId: string;
};

function baseType(element: TemplateElement): ModificationType | null {
  if (element.type === 'text') return 'text';
  if (element.type === 'image') return 'imageUrl';
  if (element.type === 'video') return 'videoUrl';
  if (element.type === 'shape') return 'fill';
  return null;
}

function contentValue(element: TemplateElement): string {
  if ('content' in element && typeof element.content === 'string') return element.content;
  if (element.type === 'shape') return String(element.style.fill ?? '');
  return '';
}

export function extractModifications(template: TemplateDocument): TemplateModification[] {
  const result: TemplateModification[] = [];

  template.pages.forEach((page, pageIndex) => {
    const prefix = pageIndex === 0 ? '' : `page${pageIndex + 1}@`;

    for (const element of page.elements) {
      if (!element.parameterizable || !element.parameterId) continue;
      const type = baseType(element);
      if (!type) continue;
      const key = `${prefix}${element.parameterId}`;
      const label = element.name || element.parameterId;
      result.push({
        key,
        id: key,
        type,
        description: `${label} — ${type}`,
        helpText: `Override ${label}`,
        example: contentValue(element),
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        pageNumber: pageIndex + 1,
        pageId: page.id,
      });
    }

    for (const track of page.audioTracks) {
      if (!track.tts?.parameterId) continue;
      const key = `${prefix}${track.tts.parameterId}`;
      result.push({
        key,
        id: key,
        type: 'voiceText',
        description: `${track.label} — narration text`,
        helpText: `Override narration for ${track.label}`,
        example: track.tts.text,
        pageNumber: pageIndex + 1,
        pageId: page.id,
      });
    }
  });

  result.push({
    key: 'canvasBackgroundColor',
    id: 'canvasBackgroundColor',
    type: 'backgroundColor',
    description: 'Canvas background color',
    helpText: 'Override the first page background color',
    example: template.pages[0]?.canvas.backgroundColor ?? '',
    pageNumber: 1,
    pageId: template.pages[0]?.id ?? '',
  });

  return result;
}

export function modificationsJson(template: TemplateDocument) {
  return Object.fromEntries(extractModifications(template).map((item) => [item.key, item.example]));
}

function pageFromKey(template: TemplateDocument, rawKey: string): { page: TemplatePage; pageIndex: number; key: string } | null {
  const match = rawKey.match(/^page(\d+)@(.+)$/);
  if (!match) {
    const page = template.pages[0];
    return page ? { page, pageIndex: 0, key: rawKey } : null;
  }

  const pageIndex = Number.parseInt(match[1], 10) - 1;
  const page = template.pages[pageIndex];
  return page ? { page, pageIndex, key: match[2] } : null;
}

function setNested(target: Record<string, unknown>, path: string[], value: unknown) {
  if (path.length === 0) return;
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const part = path[index];
    const current = cursor[part];
    if (!current || typeof current !== 'object' || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function applyElementContent(element: TemplateElement, value: unknown) {
  if (element.type === 'text' && typeof value === 'string') element.content = value;
  else if ((element.type === 'image' || element.type === 'video') && typeof value === 'string') element.content = value;
  else if (element.type === 'shape' && typeof value === 'string') element.style.fill = value;
}

function findElement(page: TemplatePage, idOrParameter: string) {
  return page.elements.find((element) => element.id === idOrParameter || element.parameterId === idOrParameter);
}

export type ApplyModificationResult = {
  document: TemplateDocument;
  warnings: string[];
};

export function applyModifications(source: TemplateDocument, changes: Record<string, unknown>): ApplyModificationResult {
  const template = structuredClone(source);
  const warnings: string[] = [];

  for (const [rawKey, value] of Object.entries(changes)) {
    const addressed = pageFromKey(template, rawKey);
    if (!addressed) {
      warnings.push(`Unknown page in modification '${rawKey}'`);
      continue;
    }
    const { page, key } = addressed;

    if (key === 'canvasBackgroundColor') {
      page.canvas.backgroundColor = String(value ?? '');
      continue;
    }
    if (key === 'canvasBackgroundImage') {
      page.canvas.backgroundImage = String(value ?? '');
      continue;
    }
    if (key.startsWith('motion.')) {
      const path = key.slice('motion.'.length).split('.');
      page.motion = page.motion ?? {};
      setNested(page.motion as Record<string, unknown>, path, value);
      continue;
    }

    const parts = key.split('.');
    const targetId = parts.shift();
    if (!targetId) continue;

    const element = findElement(page, targetId);
    if (element) {
      if (parts.length === 0) {
        applyElementContent(element, value);
        continue;
      }

      if (parts[0] === 'motion') {
        element.motion = element.motion ?? {};
        if (parts.length === 1 && value === null) element.motion = undefined;
        else setNested(element.motion as Record<string, unknown>, parts.slice(1), value);
        continue;
      }

      if (parts[0] === 'style') {
        setNested(element.style as Record<string, unknown>, parts.slice(1), value);
        continue;
      }

      if (parts.length === 1 && parts[0] in element) {
        (element as unknown as Record<string, unknown>)[parts[0]] = value;
        continue;
      }

      if (parts.length === 1 && 'style' in element) {
        (element.style as unknown as Record<string, unknown>)[parts[0]] = value;
        continue;
      }

      warnings.push(`Unknown element modification '${rawKey}'`);
      continue;
    }

    const narration = page.audioTracks.find((track) => track.tts?.parameterId === targetId);
    if (narration?.tts && parts.length === 0 && typeof value === 'string') {
      narration.tts.text = value;
      continue;
    }

    warnings.push(`Unknown modification '${rawKey}'`);
  }

  return { document: template, warnings };
}
