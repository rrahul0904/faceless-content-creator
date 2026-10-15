import { z } from 'zod';

export const VisualStoryFormatSchema = z.enum([
  'process',
  'roadmap',
  'comparison',
  'stats',
  'architecture',
  'listicle',
]);

export const MotionModeSchema = z.enum(['flow', 'build', 'pulse']);
export const VisualStorySizeSchema = z.enum(['portrait', 'square', 'landscape']);

export const VisualStoryBrandSchema = z.object({
  name: z.string().min(1).max(80).default('Creator Studio'),
  handle: z.string().max(80).default('@creator'),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6D5EF9'),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#20C7A8'),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0B1020'),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#F7F8FC'),
});

export const VisualStoryItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  detail: z.string().max(280).default(''),
  value: z.string().max(40).optional(),
});

export const VisualStorySpecSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(220).default(''),
  format: VisualStoryFormatSchema,
  motion: MotionModeSchema,
  size: VisualStorySizeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  brand: VisualStoryBrandSchema,
  items: z.array(VisualStoryItemSchema).min(1).max(8),
  sourcePrompt: z.string().min(1).max(4000),
  provenance: z.object({
    mode: z.enum(['deterministic', 'llm']),
    claimsPolicy: z.literal('source-only'),
    generatedAt: z.string(),
  }),
});

export const VisualStoryRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  format: VisualStoryFormatSchema.optional(),
  motion: MotionModeSchema.default('flow'),
  size: VisualStorySizeSchema.default('portrait'),
  brand: VisualStoryBrandSchema.partial().optional(),
});

export type VisualStoryFormat = z.infer<typeof VisualStoryFormatSchema>;
export type MotionMode = z.infer<typeof MotionModeSchema>;
export type VisualStorySize = z.infer<typeof VisualStorySizeSchema>;
export type VisualStoryBrand = z.infer<typeof VisualStoryBrandSchema>;
export type VisualStoryItem = z.infer<typeof VisualStoryItemSchema>;
export type VisualStorySpec = z.infer<typeof VisualStorySpecSchema>;
export type VisualStoryRequest = z.infer<typeof VisualStoryRequestSchema>;
