import { z } from 'zod';

export const TimedWordSchema = z.object({
  text: z.string().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  speaker: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).refine((word) => word.end >= word.start, {
  message: 'Word end must be greater than or equal to word start',
  path: ['end'],
});

export const SemanticCueSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  phrase: z.string().min(1),
  occurrence: z.number().int().min(1).default(1),
  speaker: z.string().min(1).optional(),
  padBefore: z.number().min(0).default(0),
  padAfter: z.number().min(0).default(0),
  minDuration: z.number().positive().optional(),
});

export const SemanticTimelineRequestSchema = z.object({
  words: z.array(TimedWordSchema).min(1).max(20000),
  cues: z.array(SemanticCueSchema).min(1).max(1000),
  fps: z.number().int().min(1).max(120).default(30),
}).superRefine((value, ctx) => {
  for (let index = 1; index < value.words.length; index += 1) {
    if (value.words[index].start < value.words[index - 1].start) {
      ctx.addIssue({
        code: 'custom',
        message: 'Words must be ordered by start time',
        path: ['words', index, 'start'],
      });
    }
  }

  const cueIds = new Set<string>();
  const targets = new Set<string>();
  value.cues.forEach((cue, index) => {
    if (cueIds.has(cue.id)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate cue id '${cue.id}'`, path: ['cues', index, 'id'] });
    }
    if (targets.has(cue.target)) {
      ctx.addIssue({
        code: 'custom',
        message: `Target '${cue.target}' has more than one semantic window`,
        path: ['cues', index, 'target'],
      });
    }
    cueIds.add(cue.id);
    targets.add(cue.target);
  });
});

export type TimedWord = z.infer<typeof TimedWordSchema>;
export type SemanticCue = z.infer<typeof SemanticCueSchema>;
export type SemanticTimelineRequest = z.infer<typeof SemanticTimelineRequestSchema>;
