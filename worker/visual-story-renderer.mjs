import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { renderTemplateVideo } from './template-renderer.mjs';

const execFileAsync = promisify(execFile);
const technicalIconRegistry = JSON.parse(readFileSync(new URL('../creator-console/lib/technical-icons.json', import.meta.url), 'utf8'));
const technicalIcons = new Map(technicalIconRegistry.icons.map((icon) => [icon.key, icon]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function base(id, x, y, width, height, zIndex, showAt = 0, hideAt) {
  return {
    id,
    position: { x, y },
    dimensions: { width, height },
    rotation: 0,
    zIndex,
    hidden: false,
    locked: true,
    parameterizable: false,
    transitions: {
      showAt,
      ...(hideAt == null ? {} : { hideAt }),
      enterType: 'fade',
      enterDuration: 0.22,
      exitType: 'fade',
      exitDuration: 0.18,
      easing: 'ease-out',
      ambient: 'none',
    },
  };
}

function shape(id, x, y, width, height, fill, opacity, zIndex, showAt = 0, hideAt) {
  return {
    ...base(id, x, y, width, height, zIndex, showAt, hideAt),
    type: 'shape',
    shapeType: 'rectangle',
    style: { fill, stroke: 'transparent', strokeWidth: 0, borderRadius: 20, opacity },
  };
}

function text(id, content, x, y, width, height, color, fontSize, zIndex, showAt = 0, hideAt, weight = 700) {
  return {
    ...base(id, x, y, width, height, zIndex, showAt, hideAt),
    type: 'text',
    content,
    style: {
      fontSize,
      minFontSize: 12,
      fontFamily: 'DejaVu Sans',
      fontWeight: weight,
      color,
      textAlign: 'left',
      verticalAlign: 'flex-start',
      letterSpacing: 0,
      lineHeight: 1.12,
      textMode: 'fit',
      opacity: 1,
      borderRadius: 0,
      textStrokeWidth: 0,
      textStrokeColor: '#000000',
    },
    repeatOnOverflow: false,
    flowBreakBehavior: 'line',
    flowMinLinesBeforeBreak: 2,
    flowMinLinesAfterBreak: 2,
  };
}

function image(id, content, x, y, width, height, zIndex, showAt = 0) {
  return {
    ...base(id, x, y, width, height, zIndex, showAt),
    type: 'image',
    content,
    style: {
      objectFit: 'contain',
      objectPosition: 'center center',
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      opacity: 1,
    },
  };
}

function iconForItem(item) {
  if (!item?.iconKey) return null;
  return technicalIcons.get(item.iconKey) ?? null;
}

function verifiedIconAsset(icon) {
  if (!icon?.assetPath) return null;
  const resolved = path.resolve(process.cwd(), icon.assetPath);
  return existsSync(resolved) ? resolved : null;
}

function revealAt(spec, index) {
  if (spec.motion === 'build') return 0.45 + index * 0.45;
  return 0.25;
}

function addCard(elements, spec, item, index, x, y, width, height) {
  const showAt = revealAt(spec, index);
  const icon = iconForItem(item);
  const iconAsset = verifiedIconAsset(icon);
  elements.push(shape(`card-${index}`, x, y, width, height, spec.brand.foreground, 0.075, 10, showAt));

  if (iconAsset) {
    elements.push(image(`icon-${index}`, iconAsset, x + 20, y + 17, 60, 48, 13, showAt));
  } else {
    elements.push(shape(`badge-${index}`, x + 22, y + 22, 56, 38, spec.brand.primary, 1, 12, showAt));
    const badge = icon?.fallbackLabel || String(index + 1).padStart(2, '0');
    const badgeSize = badge.length > 3 ? 13 : badge.length > 2 ? 16 : 20;
    elements.push(text(`badge-text-${index}`, badge, x + 28, y + 29, 46, 28, '#ffffff', badgeSize, 13, showAt));
  }

  const valueSpace = item.value ? 150 : 20;
  elements.push(text(
    `label-${index}`,
    item.label,
    x + 96,
    y + 20,
    Math.max(120, width - 118 - valueSpace),
    Math.max(45, height - 35),
    spec.brand.foreground,
    height < 100 ? 22 : 28,
    13,
    showAt,
  ));

  if (item.value) {
    elements.push(text(`value-${index}`, item.value, x + width - 160, y + 20, 132, 48, spec.brand.secondary, 31, 14, showAt));
  }

  if (item.detail && height >= 118) {
    elements.push(text(
      `detail-${index}`,
      item.detail,
      x + 96,
      y + Math.round(height * 0.58),
      Math.max(100, width - 124),
      Math.max(32, height * 0.32),
      '#C7CEE4',
      18,
      13,
      showAt,
      undefined,
      400,
    ));
  }

  if (spec.motion === 'pulse') {
    const pulseStart = 0.75 + index * 0.5;
    elements.push(shape(
      `pulse-${index}`,
      x - 6,
      y - 6,
      width + 12,
      height + 12,
      spec.brand.secondary,
      0.16,
      9,
      pulseStart,
      pulseStart + 0.38,
    ));
  }
}

function addFlowConnector(elements, spec, index, x, top, bottom) {
  if (bottom <= top) return;
  const lineWidth = 4;
  elements.push(shape(`line-${index}`, x - lineWidth / 2, top, lineWidth, bottom - top, spec.brand.secondary, 0.42, 7, 0.35));
  if (spec.motion !== 'flow') return;

  const distance = bottom - top;
  const steps = 5;
  for (let step = 0; step < steps; step += 1) {
    const start = 0.65 + index * 0.16 + step * 0.17;
    const y = top + Math.round((distance - 14) * (step / Math.max(steps - 1, 1)));
    elements.push(shape(`flow-${index}-${step}`, x - 7, y, 14, 14, spec.brand.secondary, 1, 8, start, start + 0.2));
  }
}

export function visualStoryToTemplateDocument(spec) {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.items) || !spec.items.length) {
    throw new Error('VisualStorySpec is invalid');
  }

  const width = Number(spec.width);
  const height = Number(spec.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 320) {
    throw new Error('VisualStorySpec canvas is invalid');
  }

  const duration = clamp(2.8 + spec.items.length * 0.48, 4, 7.5);
  const margin = Math.round(width * 0.075);
  const headerTop = 54;
  const contentTop = Math.min(Math.round(height * 0.25), 330);
  const contentBottom = height - Math.max(82, Math.round(height * 0.07));
  const available = Math.max(260, contentBottom - contentTop);
  const elements = [];

  elements.push(text('brand', String(spec.brand.name || 'CREATOR STUDIO').toUpperCase(), margin, headerTop, width * 0.55, 34, spec.brand.foreground, 21, 20));
  elements.push(text('handle', String(spec.brand.handle || '@creator'), width - margin - 220, headerTop, 220, 34, '#AAB3D0', 18, 20));
  elements.push(text('title', String(spec.title), margin, 116, width - margin * 2, 150, spec.brand.foreground, width < 900 ? 44 : 56, 20));
  if (spec.subtitle) elements.push(text('subtitle', String(spec.subtitle), margin, 235, width - margin * 2, 62, '#AAB3D0', 22, 20, 0.15, undefined, 400));

  const grid = spec.format === 'comparison' || spec.format === 'stats';
  if (grid) {
    const cols = 2;
    const gapX = 24;
    const gapY = 22;
    const rows = Math.ceil(spec.items.length / cols);
    const cardWidth = (width - margin * 2 - gapX) / cols;
    const cardHeight = clamp((available - gapY * Math.max(rows - 1, 0)) / Math.max(rows, 1), 105, 228);
    spec.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      addCard(elements, spec, item, index, margin + col * (cardWidth + gapX), contentTop + row * (cardHeight + gapY), cardWidth, cardHeight);
    });
  } else {
    const gap = spec.items.length >= 7 ? 12 : 20;
    const cardHeight = clamp((available - gap * Math.max(spec.items.length - 1, 0)) / Math.max(spec.items.length, 1), 74, 164);
    const cardWidth = width - margin * 2;
    spec.items.forEach((item, index) => {
      const y = contentTop + index * (cardHeight + gap);
      addCard(elements, spec, item, index, margin, y, cardWidth, cardHeight);
      if (index < spec.items.length - 1) {
        const nextY = contentTop + (index + 1) * (cardHeight + gap);
        addFlowConnector(elements, spec, index, width / 2, y + cardHeight, nextY);
      }
    });
  }

  elements.push(text(
    'footer-left',
    `${String(spec.format).toUpperCase()} · ${String(spec.motion).toUpperCase()} MOTION`,
    margin,
    height - 54,
    width * 0.5,
    28,
    '#8792B4',
    16,
    20,
    0.2,
    undefined,
    500,
  ));
  elements.push(text('footer-right', `Creator Console · Visual Story · icons ${technicalIconRegistry.version}`, width - margin - 390, height - 54, 390, 28, '#8792B4', 15, 20, 0.2, undefined, 500));

  return {
    schemaVersion: 1,
    name: `Visual Story ${spec.id}`,
    description: 'Generated from the owned VisualStorySpec contract.',
    tags: ['visual-story', String(spec.format), String(spec.motion)],
    canvasWidth: width,
    canvasHeight: height,
    variants: [],
    pages: [{
      id: 'visual-story-page',
      name: 'Visual Story',
      canvas: {
        width,
        height,
        backgroundColor: spec.brand.background,
        backgroundImage: '',
        borderWidth: 0,
        borderColor: 'transparent',
        borderStyle: 'solid',
      },
      elements,
      groups: [],
      audioTracks: [],
      subtitle: null,
      videoDuration: duration,
    }],
  };
}

export async function renderVisualStory({ jobId, input }) {
  const spec = input?.spec;
  const requestedOutput = input?.output === 'gif' ? 'gif' : 'mp4';
  const document = visualStoryToTemplateDocument(spec);
  const rendered = await renderTemplateVideo({
    jobId,
    document,
    response: { size: { width: spec.width, height: spec.height } },
  });

  if (requestedOutput === 'mp4') {
    return {
      ...rendered,
      engine: 'visual-story-template-v1',
      artifactType: 'mp4',
      technicalIconRegistry: technicalIconRegistry.version,
    };
  }

  const renderDir = path.resolve(process.cwd(), 'data', 'renders');
  const gifFile = path.join(renderDir, `${jobId}.gif`);
  const targetWidth = Math.min(720, Number(spec.width));
  const rawHeight = Math.max(2, Math.round(Number(spec.height) * targetWidth / Number(spec.width)));
  const targetHeight = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;
  const filter = `fps=12,scale=${targetWidth}:${targetHeight}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;

  await execFileAsync('ffmpeg', ['-y', '-i', rendered.outputFile, '-vf', filter, '-loop', '0', gifFile], {
    maxBuffer: 1024 * 1024 * 96,
  });
  const bytes = await readFile(gifFile);
  if (bytes.length < 10_000) throw new Error('Visual story GIF renderer produced an unexpectedly small artifact');
  await unlink(rendered.outputFile).catch(() => {});

  return {
    outputFile: gifFile,
    videoUrl: `/api/assets/${encodeURIComponent(`${jobId}.gif`)}`,
    duration: rendered.duration,
    bytes: bytes.length,
    engine: 'visual-story-template-gif-v1',
    artifactType: 'gif',
    pages: 1,
    width: targetWidth,
    height: targetHeight,
    technicalIconRegistry: technicalIconRegistry.version,
  };
}
