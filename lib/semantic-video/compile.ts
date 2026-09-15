import type { SemanticCue, SemanticTimelineRequest, TimedWord } from './schema';

export type SemanticTimelineErrorCode = 'ANCHOR_NOT_FOUND' | 'INVALID_ANCHOR';

export class SemanticTimelineCompileError extends Error {
  readonly code: SemanticTimelineErrorCode;
  readonly cueId: string;

  constructor(code: SemanticTimelineErrorCode, cueId: string, message: string) {
    super(message);
    this.name = 'SemanticTimelineCompileError';
    this.code = code;
    this.cueId = cueId;
  }
}

export type SemanticTimelineEvent = {
  id: string;
  target: string;
  phrase: string;
  occurrence: number;
  speaker?: string;
  wordStartIndex: number;
  wordEndIndex: number;
  start: number;
  end: number;
  startFrame: number;
  endFrameExclusive: number;
};

export type CompiledSemanticTimeline = {
  fps: number;
  duration: number;
  events: SemanticTimelineEvent[];
  modifications: Record<string, number>;
};

function normalizeToken(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function phraseTokens(phrase: string): string[] {
  return phrase
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function matchingStarts(words: TimedWord[], cue: SemanticCue): number[] {
  const wanted = phraseTokens(cue.phrase);
  if (!wanted.length) {
    throw new SemanticTimelineCompileError('INVALID_ANCHOR', cue.id, `Cue '${cue.id}' has no searchable phrase tokens`);
  }

  const tokens = words.map((word) => normalizeToken(word.text));
  const starts: number[] = [];
  const lastStart = tokens.length - wanted.length;

  for (let start = 0; start <= lastStart; start += 1) {
    let matches = true;
    for (let offset = 0; offset < wanted.length; offset += 1) {
      const word = words[start + offset];
      if (tokens[start + offset] !== wanted[offset] || (cue.speaker && word.speaker !== cue.speaker)) {
        matches = false;
        break;
      }
    }
    if (matches) starts.push(start);
  }

  return starts;
}

function compileCue(words: TimedWord[], cue: SemanticCue, fps: number): SemanticTimelineEvent {
  const wanted = phraseTokens(cue.phrase);
  const starts = matchingStarts(words, cue);
  const startIndex = starts[cue.occurrence - 1];

  if (startIndex === undefined) {
    const scope = cue.speaker ? ` for speaker '${cue.speaker}'` : '';
    throw new SemanticTimelineCompileError(
      'ANCHOR_NOT_FOUND',
      cue.id,
      `Could not find occurrence ${cue.occurrence} of '${cue.phrase}'${scope}`,
    );
  }

  const endIndex = startIndex + wanted.length - 1;
  const anchoredStart = words[startIndex].start;
  const anchoredEnd = words[endIndex].end;
  const start = Math.max(0, anchoredStart - cue.padBefore);
  let end = Math.max(start, anchoredEnd + cue.padAfter);
  if (cue.minDuration && end - start < cue.minDuration) end = start + cue.minDuration;

  const startFrame = Math.max(0, Math.floor(start * fps));
  const endFrameExclusive = Math.max(startFrame + 1, Math.ceil(end * fps));

  return {
    id: cue.id,
    target: cue.target,
    phrase: cue.phrase,
    occurrence: cue.occurrence,
    speaker: cue.speaker,
    wordStartIndex: startIndex,
    wordEndIndex: endIndex,
    start,
    end,
    startFrame,
    endFrameExclusive,
  };
}

export function compileSemanticTimeline(input: SemanticTimelineRequest): CompiledSemanticTimeline {
  const events = input.cues.map((cue) => compileCue(input.words, cue, input.fps));
  const modifications: Record<string, number> = {};

  for (const event of events) {
    modifications[`${event.target}.transitions.showAt`] = event.start;
    modifications[`${event.target}.transitions.hideAt`] = event.end;
  }

  return {
    fps: input.fps,
    duration: Math.max(0, ...input.words.map((word) => word.end), ...events.map((event) => event.end)),
    events,
    modifications,
  };
}
