import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const TEMPLATES = {
  editorial: {
    background: '0x0B0D10',
    accent: '0xD7FF64',
    titleY: 210,
    titleSize: 70,
    subtitleSize: 27,
    subtitleMargin: 180,
  },
  signal: {
    background: '0x111827',
    accent: '0x60A5FA',
    titleY: 250,
    titleSize: 74,
    subtitleSize: 28,
    subtitleMargin: 210,
  },
  ember: {
    background: '0x180F0B',
    accent: '0xFB923C',
    titleY: 190,
    titleSize: 72,
    subtitleSize: 27,
    subtitleMargin: 170,
  },
};

export function listLocalTemplates() {
  return Object.keys(TEMPLATES);
}

function templateFor(name) {
  return TEMPLATES[name] ?? TEMPLATES.editorial;
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function captionChunks(script, size = 7) {
  const words = script.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let index = 0; index < words.length; index += size) {
    chunks.push(words.slice(index, index + size).join(' '));
  }
  return chunks.length ? chunks : [''];
}

function buildSrt(script, duration) {
  const chunks = captionChunks(script);
  const slot = Math.max(duration / chunks.length, 0.7);
  return chunks.map((chunk, index) => {
    const start = index * slot;
    const end = Math.min(duration, (index + 1) * slot);
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${chunk}\n`;
  }).join('\n');
}

function voiceName(voice) {
  const allowed = new Set(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']);
  return allowed.has(voice) ? voice : 'en-us';
}

function escapeFilterPath(value) {
  return value.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
}

export async function assertLocalMediaTools() {
  await execFileAsync('ffmpeg', ['-version']);
  await execFileAsync('ffprobe', ['-version']);
  await execFileAsync('espeak-ng', ['--version']);
}

export async function renderFacelessVideo(input) {
  await assertLocalMediaTools();

  const root = path.resolve(process.cwd(), 'data');
  const workDir = path.join(root, 'work', input.jobId);
  const renderDir = path.join(root, 'renders');
  await mkdir(workDir, { recursive: true });
  await mkdir(renderDir, { recursive: true });

  const audioFile = path.join(workDir, 'voice.wav');
  const hookFile = path.join(workDir, 'hook.txt');
  const topicFile = path.join(workDir, 'topic.txt');
  const captionFile = path.join(workDir, 'captions.srt');
  const outputFile = path.join(renderDir, `${input.jobId}.mp4`);
  const template = templateFor(input.template);

  await writeFile(hookFile, input.hook.trim(), 'utf8');
  await writeFile(topicFile, String(input.topic ?? 'FACELESS').trim().toUpperCase(), 'utf8');
  await execFileAsync('espeak-ng', [
    '-v', voiceName(input.voice ?? 'en-us'),
    '-s', String(input.speechRate ?? 165),
    '-p', '52',
    '-a', '165',
    '-w', audioFile,
    input.script,
  ], { maxBuffer: 1024 * 1024 * 16 });

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioFile,
  ]);
  const duration = Math.max(Number.parseFloat(stdout.trim()) || 20, 2);
  await writeFile(captionFile, buildSrt(input.script, duration), 'utf8');

  const escapedCaptionFile = escapeFilterPath(captionFile);
  const escapedHookFile = escapeFilterPath(hookFile);
  const escapedTopicFile = escapeFilterPath(topicFile);
  const videoFilter = [
    `drawbox=x=0:y=0:w=iw:h=18:color=${template.accent}:t=fill`,
    `drawbox=x=90:y=145:w=150:h=12:color=${template.accent}:t=fill`,
    `drawtext=fontfile=${FONT}:textfile=${escapedTopicFile}:fontcolor=${template.accent}:fontsize=30:x=90:y=82`,
    `drawtext=fontfile=${FONT}:textfile=${escapedHookFile}:fontcolor=white:fontsize=${template.titleSize}:line_spacing=18:x=90:y=${template.titleY}:box=1:boxcolor=black@0.18:boxborderw=18`,
    `drawbox=x=90:y=h-115:w=900:h=2:color=white@0.24:t=fill`,
    `drawtext=fontfile=${FONT}:text='FACELESS':fontcolor=white@0.58:fontsize=24:x=90:y=h-86`,
    `subtitles=${escapedCaptionFile}:force_style='FontName=DejaVu Sans,FontSize=${template.subtitleSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H65000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=${template.subtitleMargin}'`,
    'format=yuv420p',
  ].join(',');

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=${template.background}:s=1080x1920:r=30:d=${duration.toFixed(3)}`,
    '-i', audioFile,
    '-vf', videoFilter,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    '-shortest',
    outputFile,
  ], { maxBuffer: 1024 * 1024 * 32 });

  const bytes = await readFile(outputFile);
  if (bytes.length < 10_000) throw new Error('Local renderer produced an unexpectedly small video file');

  return {
    outputFile,
    videoUrl: `/api/assets/${encodeURIComponent(`${input.jobId}.mp4`)}`,
    duration,
    bytes: bytes.length,
    engine: 'ffmpeg+espeak-ng',
    template: input.template ?? 'editorial',
  };
}
