import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { compileSemanticTimeline } from '@/lib/semantic-video/compile';
import { SemanticTimelineRequestSchema } from '@/lib/semantic-video/schema';
import type { ReferenceVideoAnalyzeRequest } from './schema';

const execFileAsync = promisify(execFile);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);

type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
};

type ProbePayload = {
  streams?: ProbeStream[];
  format?: { duration?: string; size?: string; format_name?: string };
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRate(value?: string) {
  if (!value) return 0;
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function resolveUploadedReference(filename: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error('Invalid reference filename');
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  if (!VIDEO_EXTENSIONS.has(extension)) throw new Error('Reference analysis supports MP4, WebM, and MOV video files');

  const root = path.resolve(process.cwd(), 'data', 'uploads');
  const file = path.resolve(root, filename);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Reference filename escapes the upload directory');
  return file;
}

async function probeVideo(file: string) {
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Reference media is not a file');

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ], { maxBuffer: 1024 * 1024 * 8, timeout: 120000 });

  const payload = JSON.parse(stdout) as ProbePayload;
  const video = payload.streams?.find((stream) => stream.codec_type === 'video');
  if (!video) throw new Error('Reference file has no video stream');

  const duration = Math.max(
    num(payload.format?.duration),
    num(video.duration),
  );
  if (duration <= 0) throw new Error('Unable to determine reference video duration');

  const fps = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate) || 30;
  return {
    duration,
    width: Math.max(0, Math.trunc(num(video.width))),
    height: Math.max(0, Math.trunc(num(video.height))),
    fps,
    bytes: info.size,
    format: payload.format?.format_name ?? null,
    hasAudio: Boolean(payload.streams?.some((stream) => stream.codec_type === 'audio')),
  };
}

async function detectCuts(file: string, duration: number, threshold: number) {
  const filter = `select='gt(scene,${threshold})',showinfo`;
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-i', file,
    '-filter:v', filter,
    '-an',
    '-f', 'null',
    '-',
  ], { maxBuffer: 1024 * 1024 * 32, timeout: 120000 });

  const matches = [...stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)];
  const raw = matches
    .map((match) => Number(match[1]))
    .filter((time) => Number.isFinite(time) && time > 0.02 && time < duration - 0.02)
    .sort((a, b) => a - b);

  const cuts: number[] = [];
  for (const time of raw) {
    if (!cuts.length || Math.abs(time - cuts[cuts.length - 1]) >= 0.05) cuts.push(time);
  }
  return cuts;
}

function buildScenes(duration: number, cuts: number[]) {
  const boundaries = [0, ...cuts, duration];
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    return {
      index,
      start: round(start),
      end: round(end),
      duration: round(Math.max(0, end - start)),
    };
  });
}

function rhythm(scenes: Array<{ duration: number }>, totalDuration: number) {
  const durations = scenes.map((scene) => scene.duration);
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    sceneCount: scenes.length,
    cutCount: Math.max(0, scenes.length - 1),
    averageSceneSeconds: round(durations.length ? total / durations.length : 0),
    medianSceneSeconds: round(median(durations)),
    shortestSceneSeconds: round(durations.length ? Math.min(...durations) : 0),
    longestSceneSeconds: round(durations.length ? Math.max(...durations) : 0),
    cutsPerMinute: round(totalDuration > 0 ? Math.max(0, scenes.length - 1) * 60 / totalDuration : 0, 2),
  };
}

export async function analyzeReferenceVideo(input: ReferenceVideoAnalyzeRequest) {
  const file = resolveUploadedReference(input.filename);
  const metadata = await probeVideo(file);
  const cuts = await detectCuts(file, metadata.duration, input.sceneThreshold);
  const scenes = buildScenes(metadata.duration, cuts);

  let semantic = null;
  if (input.semantic) {
    const compiled = compileSemanticTimeline(SemanticTimelineRequestSchema.parse({
      words: input.semantic.words,
      cues: input.semantic.cues,
      fps: input.semantic.fps ?? Math.max(1, Math.min(120, Math.round(metadata.fps))),
    }));

    semantic = {
      ...compiled,
      events: compiled.events.map((event) => {
        const midpoint = (event.start + event.end) / 2;
        const scene = scenes.find((candidate, index) => (
          midpoint >= candidate.start && (midpoint < candidate.end || index === scenes.length - 1)
        )) ?? scenes[scenes.length - 1];
        return {
          ...event,
          sceneIndex: scene?.index ?? 0,
          sceneStart: scene?.start ?? 0,
          sceneEnd: scene?.end ?? metadata.duration,
        };
      }),
    };
  }

  return {
    filename: input.filename,
    sceneThreshold: input.sceneThreshold,
    video: {
      duration: round(metadata.duration),
      width: metadata.width,
      height: metadata.height,
      fps: round(metadata.fps, 3),
      bytes: metadata.bytes,
      format: metadata.format,
      hasAudio: metadata.hasAudio,
    },
    cuts: cuts.map((value) => round(value)),
    scenes,
    rhythm: rhythm(scenes, metadata.duration),
    semantic,
  };
}
