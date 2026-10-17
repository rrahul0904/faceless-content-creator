import { z } from 'zod';

export const VisualStoryFormatSchema = z.enum([
  'process',
  'roadmap',
  'comparison',
  'stats',
  'architecture',
  'listicle',
]);

export const VisualStoryMotionSchema = z.enum(['flow', 'build', 'pulse']);
export const VisualStorySizeSchema = z.enum(['portrait', 'square', 'landscape']);
export const VisualStoryOutputSchema = z.enum(['mp4', 'gif']);

export const VisualStoryBrandSchema = z.object({
  name: z.string().min(1).max(80),
  handle: z.string().max(80).default('@creator'),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const VisualStoryItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  detail: z.string().max(280).default(''),
  value: z.string().max(40).optional(),
  iconKey: z.string().trim().min(1).max(120).optional(),
});

export const VisualStoryRefinementSchema = z.object({
  mode: z.literal('deterministic'),
  instruction: z.string().min(1).max(1000),
  appliedAt: z.string().min(1),
  changes: z.array(z.string().min(1).max(120)).min(1).max(20),
});

export const VisualStorySpecSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(220).default(''),
  format: VisualStoryFormatSchema,
  motion: VisualStoryMotionSchema,
  size: VisualStorySizeSchema,
  width: z.number().int().min(320).max(5000),
  height: z.number().int().min(320).max(5000),
  brand: VisualStoryBrandSchema,
  items: z.array(VisualStoryItemSchema).min(1).max(8),
  sourcePrompt: z.string().min(1).max(4000),
  provenance: z.object({
    mode: z.enum(['deterministic', 'llm']),
    claimsPolicy: z.literal('source-only'),
    generatedAt: z.string().min(1),
    refinements: z.array(VisualStoryRefinementSchema).max(20).default([]),
  }),
});

export const VisualStoryRenderRequestSchema = z.object({
  spec: VisualStorySpecSchema,
  output: VisualStoryOutputSchema.default('mp4'),
});

export type VisualStorySpec = z.infer<typeof VisualStorySpecSchema>;
export type VisualStoryOutput = z.infer<typeof VisualStoryOutputSchema>;
