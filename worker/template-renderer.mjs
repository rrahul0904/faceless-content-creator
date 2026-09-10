import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function esc(value) {
  return String(value).replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapText(text, width, fontSize) {
  const source = String(text ?? '').trim();
  if (!source) return '';
  const maxChars = Math.max(8, Math.floor(num(width, 800) / Math.max(9, num(fontSize, 48) * 0.56)));
  const paragraphs = source.split(/\n+/);
  return paragraphs.map((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.join('\n');
  }).join('\n');
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function captionChunks(script, maxWords = 4) {
  const words = String(script ?? '').trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(' '));
  return chunks.length ? chunks : [''];
}

function buildSrt(script, duration, maxWords) {
  const chunks = captionChunks(script, maxWords);
  const slot = Math.max(duration / chunks.length, 0.35);
  return chunks.map((chunk, index) => {
    const start = index * slot;
    const end = Math.min(duration, (index + 1) * slot);
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${chunk}\n`;
  }).join('\n');
}

async function probeDuration(file) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  return Math.max(num(stdout.trim(), 0), 0);
}

function voiceName(voice) {
  const allowed = new Set(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']);
  return allowed.has(voice) ? voice : 'en-us';
}

function elementWindow(element, duration) {
  const transitions = element.transitions ?? {};
  const start = clamp(num(transitions.showAt, 0), 0, duration);
  const end = clamp(num(transitions.hideAt, duration), start, duration);
  return `enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`;
}

function scaleFor(page, output) {
  return {
    x: output.width / page.canvas.width,
    y: output.height / page.canvas.height,
  };
}

function cssColor(value, fallback = '#ffffff') {
  const text = String(value || fallback).trim();
  if (text === 'transparent') return 'black@0';
  return text;
}

async function buildElementFilters(page, output, workDir) {
  const scale = scaleFor(page, output);
  const filters = [];
  const sorted = [...page.elements].filter((element) => !element.hidden).sort((a, b) => a.zIndex - b.zIndex);

  for (const element of sorted) {
    const x = Math.round(num(element.position?.x) * scale.x);
    const y = Math.round(num(element.position?.y) * scale.y);
    const width = element.dimensions?.width === 'auto' ? null : Math.max(1, Math.round(num(element.dimensions?.width, 1) * scale.x));
    const height = element.dimensions?.height === 'auto' ? null : Math.max(1, Math.round(num(element.dimensions?.height, 1) * scale.y));
    const timing = elementWindow(element, num(page.videoDuration, 60));

    if (element.type === 'shape' || element.type === 'container') {
      if (!width || !height) continue;
      const style = element.style ?? {};
      const fill = element.type === 'shape' ? style.fill : style.backgroundColor;
      filters.push(`drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${cssColor(fill, 'white')}@${num(style.opacity, 1)}:t=fill:${timing}`);
      if (num(style.strokeWidth ?? style.borderWidth, 0) > 0) {
        const sw = Math.max(1, Math.round(num(style.strokeWidth ?? style.borderWidth, 1)));
        filters.push(`drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${cssColor(style.stroke ?? style.borderColor, 'white')}@${num(style.opacity, 1)}:t=${sw}:${timing}`);
      }
      continue;
    }

    if (element.type === 'text') {
      const style = element.style ?? {};
      const fontSize = Math.max(8, Math.round(num(style.fontSize, 48) * Math.min(scale.x, scale.y)));
      const textPath = path.join(workDir, `text-${element.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`);
      await writeFile(textPath, wrapText(element.content, width ?? 800, fontSize), 'utf8');
      const lineSpacing = Math.max(0, Math.round(fontSize * (num(style.lineHeight, 1.15) - 1)));
      const alpha = clamp(num(style.opacity, 1), 0, 1);
      const borderWidth = Math.max(0, Math.round(num(style.textStrokeWidth, 0)));
      const parts = [
        `drawtext=fontfile=${FONT}`,
        `textfile=${esc(textPath)}`,
        `fontcolor=${cssColor(style.color)}@${alpha}`,
        `fontsize=${fontSize}`,
        `x=${x}`,
        `y=${y}`,
        `line_spacing=${lineSpacing}`,
      ];
      if (borderWidth > 0) {
        parts.push(`borderw=${borderWidth}`, `bordercolor=${cssColor(style.textStrokeColor, '#000000')}`);
      }
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        parts.push('box=1', `boxcolor=${cssColor(style.backgroundColor)}@0.85`, 'boxborderw=12');
      }
      parts.push(timing);
      filters.push(parts.join(':'));
      continue;
    }

    if (element.type === 'image' || element.type === 'video' || element.type === 'waveform') {
      throw new Error(`Template renderer does not support '${element.type}' layers yet (element ${element.id})`);
    }
  }

  return filters;
}

async function makePageAudio(page, pageIndex, workDir) {
  const enabled = (page.audioTracks ?? []).filter((track) => track.enabled !== false && !track.muted);
  const narration = enabled.find((track) => track.tts?.text);
  if (!narration?.tts?.text) return null;

  const file = path.join(workDir, `page-${pageIndex + 1}-voice.wav`);
  await execFileAsync('espeak-ng', [
    '-v', voiceName(narration.tts.voiceId ?? 'en-us'),
    '-s', '165', '-p', '52', '-a', '165', '-w', file,
    narration.tts.text,
  ], { maxBuffer: 1024 * 1024 * 16 });
  return { file, duration: await probeDuration(file), text: narration.tts.text };
}

async function renderPage(page, index, output, rootWork, renderPath) {
  const pageWork = path.join(rootWork, `page-${index + 1}`);
  await mkdir(pageWork, { recursive: true });
  const audio = await makePageAudio(page, index, pageWork);
  const duration = Math.max(num(page.videoDuration, 0), audio?.duration ?? 0, 2);
  const pageWithDuration = { ...page, videoDuration: duration };
  const filters = await buildElementFilters(pageWithDuration, output, pageWork);

  if (page.subtitle?.enabled && audio?.text) {
    const srtPath = path.join(pageWork, 'captions.srt');
    await writeFile(srtPath, buildSrt(audio.text, duration, page.subtitle.maxWordsPerLine ?? 4), 'utf8');
    const fontSize = Number.parseInt(String(page.subtitle.fontSize ?? '44px'), 10) || 44;
    const margin = Math.round(num(page.subtitle.offset, 120));
    filters.push(`subtitles=${esc(srtPath)}:force_style='FontName=DejaVu Sans,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H65000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=${margin}'`);
  }

  filters.push('format=yuv420p');
  const args = [
    '-y', '-f', 'lavfi',
    '-i', `color=c=${cssColor(page.canvas.backgroundColor, '#000000')}:s=${output.width}x${output.height}:r=30:d=${duration.toFixed(3)}`,
  ];
  if (audio) args.push('-i', audio.file);
  else args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration.toFixed(3)}`);
  args.push(
    '-vf', filters.join(','),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest', renderPath,
  );
  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 64 });
  return duration;
}

export async function renderTemplateVideo({ jobId, document, response = {} }) {
  const root = path.resolve(process.cwd(), 'data');
  const workDir = path.join(root, 'work', jobId);
  const renderDir = path.join(root, 'renders');
  await mkdir(workDir, { recursive: true });
  await mkdir(renderDir, { recursive: true });

  const requested = response.size;
  const output = requested && num(requested.width) > 0 && num(requested.height) > 0
    ? { width: Math.round(requested.width), height: Math.round(requested.height) }
    : { width: document.canvasWidth, height: document.canvasHeight };

  const pageFiles = [];
  let totalDuration = 0;
  for (let index = 0; index < document.pages.length; index += 1) {
    const pageFile = path.join(workDir, `page-${index + 1}.mp4`);
    totalDuration += await renderPage(document.pages[index], index, output, workDir, pageFile);
    pageFiles.push(pageFile);
  }

  const outputFile = path.join(renderDir, `${jobId}.mp4`);
  if (pageFiles.length === 1) {
    await execFileAsync('ffmpeg', ['-y', '-i', pageFiles[0], '-c', 'copy', '-movflags', '+faststart', outputFile]);
  } else {
    const concatFile = path.join(workDir, 'pages.txt');
    await writeFile(concatFile, pageFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'), 'utf8');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', outputFile]);
  }

  const bytes = await readFile(outputFile);
  if (bytes.length < 10_000) throw new Error('Template renderer produced an unexpectedly small video file');
  return {
    outputFile,
    videoUrl: `/api/assets/${encodeURIComponent(`${jobId}.mp4`)}`,
    duration: totalDuration,
    bytes: bytes.length,
    engine: 'template-engine-v1',
    pages: document.pages.length,
    width: output.width,
    height: output.height,
  };
}
