// Independent, bounded agent-to-film compiler. Does not evaluate agent-authored HTML or JavaScript.
// This file intentionally has no third-party dependencies so its contracts can be tested with node:test.
import { createHash } from 'node:crypto';

export class FilmPlanError extends Error {
  constructor(message) { super(message); this.name = 'FilmPlanError'; }
}

function fail(where, message) { throw new FilmPlanError(where + ': ' + message); }
function record(value, where) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(where, 'expected an object');
  return value;
}
function string(value, where, max = 255, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(where, 'expected non-empty text up to ' + max + ' characters');
  return value.trim();
}
function num(value, where, lo, hi) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) fail(where, 'expected finite number in [' + lo + ', ' + hi + ']');
  return value;
}
function identifier(value, where) {
  const id = string(value, where, 64);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) fail(where, 'must start with a letter and contain only letters, numbers, _ or -');
  return id;
}
function color(value, where, fallback) {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(candidate)) fail(where, 'expected #RRGGBB color');
  return candidate.toUpperCase();
}
function box(value, where) {
  const r = record(value, where);
  const x = num(r.x, where + '.x', 0, 1);
  const y = num(r.y, where + '.y', 0, 1);
  const width = num(r.width, where + '.width', 0.001, 1);
  const height = num(r.height, where + '.height', 0.001, 1);
  if (x + width > 1.000001 || y + height > 1.000001) fail(where, 'bounds must stay inside canvas');
  return { x, y, width, height };
}
const CANVASES = Object.freeze({
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
});

function layer(input, scene, sceneIndex, layerIndex) {
  const where = 'scenes[' + sceneIndex + '].layers[' + layerIndex + ']';
  const value = record(input, where);
  const id = identifier(value.id, where + '.id');
  const type = value.type;
  if (type !== 'text' && type !== 'shape') fail(where + '.type', 'only text and shape are supported in FilmPlan v1');
  const start = num(value.start ?? 0, where + '.start', 0, scene.duration);
  const end = num(value.end ?? scene.duration, where + '.end', 0, scene.duration);
  if (end <= start) fail(where, 'end must be greater than start');
  const bounds = box(value.bounds, where + '.bounds');
  if (type === 'text') {
    return {
      id, type, start, end, bounds,
      text: string(value.text, where + '.text', 4000),
      color: color(value.color, where + '.color', '#FFFFFF'),
      fontSize: num(value.fontSize ?? 74, where + '.fontSize', 12, 260),
      align: value.align === undefined ? 'left' : value.align,
    };
  }
  return { id, type, start, end, bounds, fill: color(value.fill, where + '.fill', '#D7FF64') };
}

function scene(input, index) {
  const where = 'scenes[' + index + ']';
  const value = record(input, where);
  const duration = num(value.duration, where + '.duration', 2, 45);
  const sceneSpec = {
    id: identifier(value.id, where + '.id'),
    name: string(value.name ?? value.id, where + '.name', 80),
    duration,
    background: color(value.background, where + '.background', '#0B0D10'),
    narration: value.narration === undefined ? '' : string(value.narration, where + '.narration', 2000, true),
    layers: [],
  };
  if (!Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > 30) fail(where + '.layers', 'expected 1..30 layers');
  sceneSpec.layers = value.layers.map((item, layerIndex) => layer(item, sceneSpec, index, layerIndex));
  const ids = new Set();
  for (const item of sceneSpec.layers) {
    if (ids.has(item.id)) fail(where, 'duplicate layer id ' + item.id);
    ids.add(item.id);
    if (item.type === 'text' && !['left', 'center', 'right'].includes(item.align)) fail(where, 'text alignment must be left, center or right');
  }
  return sceneSpec;
}

export function validateFilmPlan(input) {
  const p = record(input, 'plan');
  const format = p.format ?? 'portrait';
  if (!Object.hasOwn(CANVASES, format)) fail('plan.format', 'use portrait, landscape or square');
  if (!Array.isArray(p.scenes) || p.scenes.length < 1 || p.scenes.length > 8) fail('plan.scenes', 'expected 1..8 scenes');
  const scenes = p.scenes.map(scene);
  const ids = new Set();
  for (const entry of scenes) {
    if (ids.has(entry.id)) fail('plan.scenes', 'duplicate scene id ' + entry.id);
    ids.add(entry.id);
  }
  const duration = scenes.reduce((acc, item) => acc + item.duration, 0);
  if (duration > 180) fail('plan', 'combined duration may not exceed 180 seconds');
  return { format, name: string(p.name, 'plan.name', 120), scenes };
}

function position(bounds, canvas) {
  const x = Math.round(bounds.x * canvas.width);
  const y = Math.round(bounds.y * canvas.height);
  return {
    position: { x, y },
    dimensions: {
      width: Math.max(1, Math.min(canvas.width - x, Math.round(bounds.width * canvas.width))),
      height: Math.max(1, Math.min(canvas.height - y, Math.round(bounds.height * canvas.height))),
    },
  };
}

function element(input, canvas, index) {
  const geometry = position(input.bounds, canvas);
  const common = {
    id: input.id, name: input.id, position: geometry.position, dimensions: geometry.dimensions,
    rotation: 0, zIndex: index + 1, hidden: false, locked: false, parameterizable: true, parameterId: input.id,
    transitions: {
      showAt: input.start, hideAt: input.end, enterType: 'none', enterDuration: 0,
      exitType: 'none', exitDuration: 0, easing: 'ease-out', ambient: 'none',
    },
  };
  if (input.type === 'shape') return {
    ...common, type: 'shape', shapeType: 'rectangle',
    style: { fill: input.fill, stroke: 'transparent', strokeWidth: 0, borderRadius: 0, opacity: 1 },
  };
  return {
    ...common, type: 'text', content: input.text,
    style: {
      fontSize: input.fontSize, minFontSize: 12, fontFamily: 'Inter', fontWeight: 800,
      color: input.color, textAlign: input.align, verticalAlign: 'flex-start',
      letterSpacing: 0, lineHeight: 1.15, textMode: 'fit', opacity: 1,
      borderRadius: 0, textStrokeWidth: 0, textStrokeColor: '#000000',
    },
  };
}

export function compileFilmPlan(input) {
  const plan = validateFilmPlan(input);
  const canvas = CANVASES[plan.format];
  const pages = plan.scenes.map((shot) => ({
    id: shot.id, name: shot.name, videoDuration: shot.duration,
    canvas: { ...canvas, backgroundColor: shot.background, backgroundImage: '', borderWidth: 0, borderColor: 'transparent', borderStyle: 'solid' },
    elements: shot.layers.map((item, index) => element(item, canvas, index)),
    groups: [],
    audioTracks: shot.narration ? [{
      id: shot.id + '-narration', label: 'Local narration', tts: { text: shot.narration, modelId: 'local', voiceId: 'en-us' },
      volume: 1, fadeIn: 0, fadeOut: 0, trimStart: 0, trimEnd: null, offset: 0, loop: false, muted: false, enabled: true,
    }] : [],
    subtitle: shot.narration ? { enabled: true, source: 'auto-audio' } : null,
  }));
  const document = {
    schemaVersion: 1, name: plan.name,
    description: 'Agent-authored editable storyboard using FilmPlan v1',
    tags: ['agent-film', 'film-plan-v1', plan.format],
    canvasWidth: canvas.width, canvasHeight: canvas.height, pages, variants: [],
  };
  const duration = plan.scenes.reduce((acc, shot) => acc + shot.duration, 0);
  const planHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { document, normalizedPlan: plan, duration, planHash, sceneCount: pages.length };
}
