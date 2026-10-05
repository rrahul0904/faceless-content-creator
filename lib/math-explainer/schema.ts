import { z } from 'zod';

const IdentifierSchema = z.string().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const ClaimVerificationSchema = z.object({
  method: z.enum(['enumerative', 'numeric', 'symbolic', 'source', 'human']),
  evidence: z.string().min(8).max(2000),
}).strict();

export const MathClaimSchema = z.object({
  id: IdentifierSchema,
  statement: z.string().min(8).max(4000),
  kind: z.enum(['definition', 'fact', 'derivation', 'result', 'intuition', 'counterexample']),
  critical: z.boolean().default(false),
  requiresContrast: z.boolean().default(false),
  verification: ClaimVerificationSchema.optional(),
}).strict();

export const ExplainerSceneSchema = z.object({
  id: IdentifierSchema,
  chapterId: IdentifierSchema,
  title: z.string().min(1).max(240),
  role: z.enum(['orient', 'define', 'derive', 'demonstrate', 'contrast', 'conclude']),
  durationSeconds: z.number().min(1).max(180),
  narration: z.string().min(1).max(6000),
  claimIds: z.array(IdentifierSchema).max(30).default([]),
  visualIntents: z.array(z.string().min(1).max(1000)).min(1).max(30),
  editable: z.boolean().default(true),
}).strict();

export const ExplainerChapterSchema = z.object({
  id: IdentifierSchema,
  title: z.string().min(1).max(240),
  sceneIds: z.array(IdentifierSchema).min(1).max(50),
}).strict();

export const MathExplainerDraftSchema = z.object({
  schemaVersion: z.literal(1),
  question: z.string().min(3).max(4000),
  audience: z.string().min(2).max(500),
  targetDurationSeconds: z.number().min(15).max(600),
  renderer: z.literal('manim').default('manim'),
  output: z.object({
    resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
    fps: z.number().int().min(24).max(60).default(30),
    captions: z.enum(['none', 'srt', 'burned+srt']).default('srt'),
  }).strict().default({ resolution: '1080p', fps: 30, captions: 'srt' }),
  claims: z.array(MathClaimSchema).min(1).max(100),
  chapters: z.array(ExplainerChapterSchema).min(1).max(30),
  scenes: z.array(ExplainerSceneSchema).min(1).max(150),
}).strict().superRefine((draft, ctx) => {
  const unique = (values: string[], path: Array<string | number>, label: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate ${label} id '${value}'`, path: [...path, index, 'id'] });
      }
      seen.add(value);
    });
  };

  unique(draft.claims.map((item) => item.id), ['claims'], 'claim');
  unique(draft.chapters.map((item) => item.id), ['chapters'], 'chapter');
  unique(draft.scenes.map((item) => item.id), ['scenes'], 'scene');
});

export type MathExplainerDraft = z.infer<typeof MathExplainerDraftSchema>;
export type MathClaim = z.infer<typeof MathClaimSchema>;
export type ExplainerScene = z.infer<typeof ExplainerSceneSchema>;
