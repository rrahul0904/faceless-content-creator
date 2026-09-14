import type { TemplateDocument, TemplateElement, TemplatePage } from './schema';

export type ResizeTarget = { width: number; height: number };
export type Anchor = 'start' | 'center' | 'end' | 'stretch';

function numericDimension(value: number | 'auto', fallback: number) {
  return value === 'auto' ? fallback : value;
}

function inferAxisAnchor(position: number, size: number, canvasSize: number): Anchor {
  const startGap = position;
  const endGap = canvasSize - position - size;
  const center = position + size / 2;
  const centerDistance = Math.abs(center - canvasSize / 2);
  const edgeThreshold = Math.max(28, canvasSize * 0.07);
  const centerThreshold = Math.max(28, canvasSize * 0.065);

  if (size >= canvasSize * 0.88) return 'stretch';
  if (Math.abs(startGap - endGap) <= centerThreshold || centerDistance <= centerThreshold) return 'center';
  if (startGap <= edgeThreshold || startGap < endGap * 0.62) return 'start';
  if (endGap <= edgeThreshold || endGap < startGap * 0.62) return 'end';
  return center < canvasSize / 2 ? 'start' : 'end';
}

function resizeAxis(position: number, size: number, base: number, target: number, scale: number, anchor: Anchor) {
  const scaledSize = size * scale;
  if (anchor === 'stretch') return { position: 0, size: target };
  if (anchor === 'start') return { position: position * scale, size: scaledSize };
  if (anchor === 'end') {
    const gap = base - position - size;
    return { position: target - gap * scale - scaledSize, size: scaledSize };
  }
  const deltaFromCenter = position + size / 2 - base / 2;
  return { position: target / 2 + deltaFromCenter * scale - scaledSize / 2, size: scaledSize };
}

function resizeElement(element: TemplateElement, page: TemplatePage, target: ResizeTarget, scale: number): TemplateElement {
  const width = numericDimension(element.dimensions.width, Math.max(1, page.canvas.width - element.position.x));
  const height = numericDimension(element.dimensions.height, Math.max(1, page.canvas.height - element.position.y));
  const horizontal = inferAxisAnchor(element.position.x, width, page.canvas.width);
  const vertical = inferAxisAnchor(element.position.y, height, page.canvas.height);
  const x = resizeAxis(element.position.x, width, page.canvas.width, target.width, scale, horizontal);
  const y = resizeAxis(element.position.y, height, page.canvas.height, target.height, scale, vertical);

  const next = structuredClone(element);
  next.position = { x: Math.round(x.position), y: Math.round(y.position) };
  next.dimensions = {
    width: element.dimensions.width === 'auto' ? 'auto' : Math.max(1, Math.round(x.size)),
    height: element.dimensions.height === 'auto' ? 'auto' : Math.max(1, Math.round(y.size)),
  };

  if (next.type === 'text') {
    next.style.fontSize = Math.max(next.style.minFontSize, Math.round(next.style.fontSize * scale));
    if (typeof next.style.borderRadius === 'number') next.style.borderRadius = Math.round(next.style.borderRadius * scale);
    if (typeof next.style.textStrokeWidth === 'number') next.style.textStrokeWidth = next.style.textStrokeWidth * scale;
  }
  if ('style' in next && typeof next.style.borderRadius === 'number') next.style.borderRadius = Math.round(next.style.borderRadius * scale);
  return next;
}

function resizePage(page: TemplatePage, target: ResizeTarget): TemplatePage {
  const widthScale = target.width / page.canvas.width;
  const heightScale = target.height / page.canvas.height;
  const scale = Math.min(widthScale, heightScale);
  const next = structuredClone(page);
  next.canvas.width = target.width;
  next.canvas.height = target.height;
  next.elements = page.elements.map((element) => resizeElement(element, page, target, scale));
  return next;
}

export function resizeTemplate(source: TemplateDocument, target: ResizeTarget): TemplateDocument {
  const variant = source.variants.find((item) => item.width === target.width && item.height === target.height && item.mode !== 'auto' && item.pages?.length);
  const next = structuredClone(source);
  next.canvasWidth = target.width;
  next.canvasHeight = target.height;
  next.pages = variant?.pages?.length
    ? structuredClone(variant.pages)
    : source.pages.map((page) => resizePage(page, target));
  return next;
}
