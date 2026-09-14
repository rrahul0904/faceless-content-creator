import { z } from 'zod';

export const PositionSchema = z.object({ x: z.number(), y: z.number() });
export const DimensionsSchema = z.object({
  width: z.union([z.number().positive(), z.literal('auto')]),
  height: z.union([z.number().positive(), z.literal('auto')]),
});

const KeyframeSchema = z.object({
  at: z.number().min(0), x: z.number().optional(), y: z.number().optional(),
  scale: z.number().positive().optional(), rotate: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

export const MotionSchema = z.object({
  reveal: z.object({
    by: z.enum(['word', 'char']).default('word'), stagger: z.number().min(0).default(0.07),
    duration: z.number().positive().default(0.7), dy: z.number().default(120),
  }).optional(),
  typewriter: z.object({ duration: z.number().positive().default(1.6), delay: z.number().min(0).default(0) }).optional(),
  count: z.object({
    from: z.number().default(0), to: z.number(), duration: z.number().positive().default(1.4),
    decimals: z.number().int().min(0).max(8).default(0), prefix: z.string().default(''), suffix: z.string().default(''),
  }).optional(),
  wake: z.object({
    duration: z.number().positive().default(0.6), from: z.enum(['up', 'down', 'left', 'right', 'none']).default('up'),
    distance: z.number().default(34), offset: z.number().min(0).default(0),
  }).optional(),
  after: z.object({ element: z.string().min(1), offset: z.number().default(0) }).optional(),
  pulse: z.object({
    from: z.number().positive().default(0.97), to: z.number().positive().default(1.03),
    rate: z.number().positive().default(1.6), axis: z.enum(['y', 'both']).default('both'),
  }).optional(),
  float: z.object({ amp: z.number().default(6), rate: z.number().positive().default(2.4) }).optional(),
  press: z.object({ at: z.number().min(0), dip: z.number().default(6) }).optional(),
  sleep: z.object({ at: z.number().min(0), duration: z.number().positive().default(0.45) }).optional(),
  keyframes: z.array(KeyframeSchema).max(2000).optional(),
}).passthrough();

export const TransitionSchema = z.object({
  showAt: z.number().min(0).default(0),
  hideAt: z.number().min(0).optional(),
  enterType: z.enum(['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'scale-up', 'scale-down']).default('none'),
  enterDuration: z.number().min(0).default(0.4),
  exitType: z.enum(['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'scale-up', 'scale-down']).default('none'),
  exitDuration: z.number().min(0).default(0.4),
  easing: z.string().default('ease-out'),
  ambient: z.enum(['none', 'pulse', 'float', 'drift', 'rotate']).default('none'),
}).passthrough();

const ElementBaseSchema = z.object({
  id: z.string().min(1), name: z.string().optional(), position: PositionSchema, dimensions: DimensionsSchema,
  rotation: z.number().default(0), zIndex: z.number().int().default(0), hidden: z.boolean().default(false),
  locked: z.boolean().default(false), groupId: z.string().optional(), parameterizable: z.boolean().default(false),
  parameterId: z.string().optional(), transitions: TransitionSchema.optional(), motion: MotionSchema.optional(),
});

const TextStyleSchema = z.object({
  fontSize: z.number().positive().default(48), minFontSize: z.number().positive().default(8),
  fontFamily: z.string().default('Inter'), fontWeight: z.union([z.string(), z.number()]).default(700),
  color: z.string().default('#ffffff'), textAlign: z.enum(['left', 'center', 'right']).default('left'),
  verticalAlign: z.enum(['flex-start', 'center', 'flex-end']).default('flex-start'), letterSpacing: z.number().default(0),
  lineHeight: z.number().positive().default(1.15), textMode: z.enum(['fit', 'overflow', 'truncate', 'flow']).default('fit'),
  opacity: z.number().min(0).max(1).default(1), backgroundColor: z.string().optional(), borderRadius: z.number().min(0).default(0),
  textStrokeWidth: z.number().min(0).default(0), textStrokeColor: z.string().default('#000000'),
}).passthrough();

export const TextElementSchema = ElementBaseSchema.extend({
  type: z.literal('text'), content: z.string().default(''), style: TextStyleSchema,
  repeatOnOverflow: z.boolean().default(false), flowZones: z.array(z.object({ y: z.number(), height: z.number().positive() })).optional(),
  flowBreakBehavior: z.enum(['line', 'word', 'char']).default('line'), flowMinLinesBeforeBreak: z.number().int().min(1).default(2),
  flowMinLinesAfterBreak: z.number().int().min(1).default(2),
});

const ImageStyleSchema = z.object({
  objectFit: z.enum(['contain', 'cover', 'fill']).default('cover'), objectPosition: z.string().default('center center'),
  borderRadius: z.number().min(0).default(0), borderWidth: z.number().min(0).default(0), borderColor: z.string().default('#000000'),
  opacity: z.number().min(0).max(1).default(1), filter: z.string().optional(),
}).passthrough();

export const ImageElementSchema = ElementBaseSchema.extend({ type: z.literal('image'), content: z.string().default(''), style: ImageStyleSchema });

const ShapeStyleSchema = z.object({
  fill: z.string().default('#ffffff'), stroke: z.string().default('transparent'), strokeWidth: z.number().min(0).default(0),
  borderRadius: z.number().min(0).default(0), opacity: z.number().min(0).max(1).default(1),
}).passthrough();

export const ShapeElementSchema = ElementBaseSchema.extend({
  type: z.literal('shape'), shapeType: z.enum(['rectangle', 'ellipse', 'line', 'arrow']).default('rectangle'), style: ShapeStyleSchema,
});

const VideoStyleSchema = z.object({
  objectFit: z.enum(['contain', 'cover', 'fill']).default('cover'), objectPosition: z.string().default('center center'),
  borderRadius: z.number().min(0).default(0), opacity: z.number().min(0).max(1).default(1),
}).passthrough();

export const VideoElementSchema = ElementBaseSchema.extend({
  type: z.literal('video'), content: z.string().default(''), trimStart: z.number().min(0).default(0),
  trimEnd: z.number().min(0).nullable().default(null), muted: z.boolean().default(true), loop: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(1), style: VideoStyleSchema,
});

const WaveformStyleSchema = z.object({ fill: z.string().default('#ffffff'), opacity: z.number().min(0).max(1).default(1) }).passthrough();
export const WaveformElementSchema = ElementBaseSchema.extend({
  type: z.literal('waveform'), waveTrack: z.number().int().min(0).default(0), barCount: z.number().int().min(4).max(400).default(48),
  barGap: z.number().min(0).default(4), waveAlign: z.enum(['top', 'center', 'bottom']).default('center'),
  minBarHeight: z.number().min(0).default(2), borderRadius: z.number().min(0).default(2), style: WaveformStyleSchema,
});

const ContainerStyleSchema = z.object({
  backgroundColor: z.string().default('transparent'), borderRadius: z.number().min(0).default(0), borderWidth: z.number().min(0).default(0),
  borderColor: z.string().default('transparent'), opacity: z.number().min(0).max(1).default(1),
}).passthrough();
export const ContainerElementSchema = ElementBaseSchema.extend({ type: z.literal('container'), style: ContainerStyleSchema });

export const TemplateElementSchema = z.discriminatedUnion('type', [
  TextElementSchema, ImageElementSchema, ShapeElementSchema, VideoElementSchema, WaveformElementSchema, ContainerElementSchema,
]);

export const AudioTrackSchema = z.object({
  id: z.string().min(1), label: z.string().default('Audio'), url: z.string().optional(), filename: z.string().optional(),
  duration: z.number().positive().optional(),
  tts: z.object({ text: z.string(), voiceId: z.string().default('en-us'), modelId: z.string().default('local'), parameterId: z.string().optional() }).optional(),
  sfx: z.object({ prompt: z.string(), seconds: z.number().min(1).max(22).optional() }).optional(),
  volume: z.number().min(0).max(1).default(1), fadeIn: z.number().min(0).default(0), fadeOut: z.number().min(0).default(0),
  trimStart: z.number().min(0).default(0), trimEnd: z.number().min(0).nullable().default(null), offset: z.number().min(0).default(0),
  loop: z.boolean().default(false), muted: z.boolean().default(false), enabled: z.boolean().default(true),
});

export const SubtitleSchema = z.object({
  url: z.string().optional(), filename: z.string().optional(), source: z.enum(['upload', 'auto-audio', 'generated']).default('auto-audio'),
  enabled: z.boolean().default(true), cueCount: z.number().int().min(0).optional(), fontSize: z.string().default('44px'),
  fontFamily: z.string().default('Inter, sans-serif'), fontWeight: z.string().default('700'), color: z.string().default('#ffffff'),
  highlightColor: z.string().default('#D7FF64'), background: z.string().default('rgba(0,0,0,0.35)'),
  position: z.enum(['bottom', 'center', 'top']).default('bottom'), offset: z.number().min(0).default(120),
  mode: z.enum(['phrase', 'word-by-word']).default('word-by-word'), wordReveal: z.enum(['appear', 'highlight', 'align']).default('highlight'),
  split: z.enum(['word', 'letter']).default('word'), maxWordsPerLine: z.number().int().min(1).max(20).default(4),
  maxCharsPerLine: z.number().int().positive().optional(),
}).nullable();

export const PageMotionSchema = z.object({
  look: z.object({ grain: z.number().min(0).max(0.2).default(0), vignette: z.number().min(0).max(0.6).default(0) }).optional(),
  camera: z.object({
    moves: z.array(z.object({
      at: z.number().min(0), duration: z.number().positive(), x: z.number().default(0), y: z.number().default(0),
      zoom: z.number().positive().default(1), ease: z.string().default('ease-in-out'),
    })).max(100),
  }).optional(),
}).passthrough();

export const TemplatePageSchema = z.object({
  id: z.string().min(1), name: z.string().default('Page'),
  canvas: z.object({
    width: z.number().int().min(10).max(5000), height: z.number().int().min(10).max(5000),
    backgroundColor: z.string().default('#000000'), backgroundImage: z.string().default(''), borderWidth: z.number().min(0).default(0),
    borderColor: z.string().default('transparent'), borderStyle: z.string().default('solid'),
  }),
  elements: z.array(TemplateElementSchema).max(1000).default([]), groups: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  audioTracks: z.array(AudioTrackSchema).default([]), subtitle: SubtitleSchema.default(null),
  videoDuration: z.number().min(0.1).max(120).nullable().default(null), motion: PageMotionSchema.optional(), thumbnailUrl: z.string().optional(),
});

export const TemplateVariantSchema = z.object({
  id: z.string(), name: z.string(), width: z.number().int().min(10).max(5000), height: z.number().int().min(10).max(5000),
  mode: z.enum(['auto', 'edited', 'ai']).default('auto'), pages: z.array(TemplatePageSchema).optional(),
});

export const TemplateDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1), id: z.string().optional(), name: z.string().min(1).max(255), description: z.string().default(''),
  tags: z.array(z.string()).default([]), canvasWidth: z.number().int().min(10).max(5000), canvasHeight: z.number().int().min(10).max(5000),
  pages: z.array(TemplatePageSchema).min(1).max(100), variants: z.array(TemplateVariantSchema).max(24).default([]),
});

export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>;
export type TemplatePage = z.infer<typeof TemplatePageSchema>;
export type TemplateElement = z.infer<typeof TemplateElementSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type SubtitleConfig = z.infer<typeof SubtitleSchema>;
