import { z } from 'zod';
import { SemanticCueSchema, TimedWordSchema } from '@/lib/semantic-video/schema';

export const ReferenceVideoAnalyzeRequestSchema = z.object({
  filename: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  sceneThreshold: z.number().min(0.01).max(1).default(0.3),
  semantic: z.object({
    words: z.array(TimedWordSchema).min(1).max(20000),
    cues: z.array(SemanticCueSchema).min(1).max(1000),
    fps: z.number().int().min(1).max(120).optional(),
  }).optional(),
});

export type ReferenceVideoAnalyzeRequest = z.infer<typeof ReferenceVideoAnalyzeRequestSchema>;
