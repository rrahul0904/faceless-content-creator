import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function esc(value) {
  return String(value).replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'").replaceAll(',', '\\,');
}
function num(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function safeId(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function cssColor(value, fallback = '#ffffff') {
  const text = String(value || fallback).trim();
  return text === 'transparent' ? 'black@0' : text;
}
function voiceName(voice) {
  const allowed = new Set(['en-us', 'en-gb', 'en-sc', 'en', 'en-westindies']);
  return allowed.has(voice) ? voice : 'en-us';
}

function wrapText(text, width, fontSize) {
  const source = String(text ?? '').trim();
  if (!source) return '';
  const maxChars = Math.max(8, Math.floor(num(width, 800) / Math.max(9, num(fontSize, 48) * 0.56)));
  return source.split(/\n+/).map((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) { lines.push(line); line = word; }
      else line = candidate;
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
function buildSrt(script, duration, maxWords = 4) {
  const words = String(script ?? '').trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(' '));
  if (!chunks.length) chunks.push('');
  const slot = Math.max(duration / chunks.length, 0.35);
  return chunks.map((chunk, index) => `${index + 1}\n${srtTime(index * slot)} --> ${srtTime(Math.min(duration, (index + 1) * slot))}\n${chunk}\n`).join('\n');
}

async function probeDuration(file) {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { maxBuffer: 1024 * 1024 * 4 });
    return Math.max(num(stdout.trim(), 0), 0);
  } catch { return 0; }
}

function elementWindow(element, duration) {
  const transitions = element.transitions ?? {};
  const start = clamp(num(transitions.showAt, 0), 0, duration);
  const end = clamp(num(transitions.hideAt, duration), start, duration);
  return `enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`;
}

function scaleFor(page, output) { return { x: output.width / page.canvas.width, y: output.height / page.canvas.height }; }
function mediaGeometry(element, page, output) {
  const scale = scaleFor(page, output);
  return {
    x: Math.round(num(element.position?.x) * scale.x), y: Math.round(num(element.position?.y) * scale.y),
    width: element.dimensions?.width === 'auto' ? Math.max(1, output.width) : Math.max(1, Math.round(num(element.dimensions?.width, 1) * scale.x)),
    height: element.dimensions?.height === 'auto' ? Math.max(1, output.height) : Math.max(1, Math.round(num(element.dimensions?.height, 1) * scale.y)),
    scale,
  };
}

function mediaScaleFilter(width, height, objectFit = 'cover') {
  if (objectFit === 'fill') return `scale=${width}:${height}`;
  if (objectFit === 'contain') return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}

async function prepareAudioTracks(page, pageIndex, workDir) {
  const tracks = [];
  for (let index = 0; index < (page.audioTracks ?? []).length; index += 1) {
    const track = page.audioTracks[index];
    if (track.enabled === false || track.muted) continue;
    let source = track.url || null;
    let narrationText = null;
    if (track.tts?.text) {
      source = path.join(workDir, `page-${pageIndex + 1}-voice-${index + 1}.wav`);
      narrationText = track.tts.text;
      await execFileAsync('espeak-ng', [
        '-v', voiceName(track.tts.voiceId ?? 'en-us'), '-s', '165', '-p', '52', '-a', '165', '-w', source, track.tts.text,
      ], { maxBuffer: 1024 * 1024 * 16 });
    }
    if (!source) continue;
    const detectedDuration = await probeDuration(source);
    tracks.push({ track, source, detectedDuration, narrationText });
  }
  return tracks;
}

async function prepareMediaInputs(page, duration) {
  const media = [];
  for (const element of [...page.elements].filter((item) => !item.hidden).sort((a, b) => a.zIndex - b.zIndex)) {
    if ((element.type === 'image' || element.type === 'video') && element.content) {
      media.push({ element, source: element.content, duration });
    }
  }
  return media;
}

function audioFilterFor(trackInfo, inputIndex, label, duration) {
  const { track } = trackInfo;
  const trimStart = Math.max(0, num(track.trimStart, 0));
  const trimEnd = track.trimEnd == null ? null : Math.max(trimStart, num(track.trimEnd, duration));
  const offsetMs = Math.round(Math.max(0, num(track.offset, 0)) * 1000);
  const filters = [`atrim=start=${trimStart}${trimEnd === null ? '' : `:end=${trimEnd}`}`, 'asetpts=PTS-STARTPTS'];
  if (offsetMs) filters.push(`adelay=${offsetMs}|${offsetMs}`);
  if (num(track.fadeIn, 0) > 0) filters.push(`afade=t=in:st=0:d=${num(track.fadeIn).toFixed(3)}`);
  if (num(track.fadeOut, 0) > 0) {
    const sourceDuration = trimEnd === null ? Math.min(trackInfo.detectedDuration || duration, duration) : trimEnd - trimStart;
    filters.push(`afade=t=out:st=${Math.max(0, sourceDuration - num(track.fadeOut)).toFixed(3)}:d=${num(track.fadeOut).toFixed(3)}`);
  }
  filters.push(`volume=${clamp(num(track.volume, 1), 0, 1).toFixed(3)}`);
  return `[${inputIndex}:a]${filters.join(',')}[${label}]`;
}

async function renderPage(page, index, output, rootWork, renderPath) {
  const pageWork = path.join(rootWork, `page-${index + 1}`);
  await mkdir(pageWork, { recursive: true });
  const audioTracks = await prepareAudioTracks(page, index, pageWork);
  const audioExtent = Math.max(0, ...audioTracks.map(({ track, detectedDuration }) => num(track.offset, 0) + (detectedDuration || 0)));
  const duration = Math.max(num(page.videoDuration, 0), audioExtent, 2);
  const mediaInputs = await prepareMediaInputs(page, duration);
  const args = ['-y', '-f', 'lavfi', '-i', `color=c=${cssColor(page.canvas.backgroundColor, '#000000')}:s=${output.width}x${output.height}:r=30:d=${duration.toFixed(3)}`];

  const mediaIndexes = new Map();
  let nextInput = 1;
  for (const media of mediaInputs) {
    if (media.element.type === 'image') args.push('-loop', '1', '-t', duration.toFixed(3), '-i', media.source);
    else {
      if (media.element.loop) args.push('-stream_loop', '-1');
      if (num(media.element.trimStart, 0) > 0) args.push('-ss', String(num(media.element.trimStart, 0)));
      if (media.element.trimEnd != null) args.push('-t', String(Math.max(0.1, num(media.element.trimEnd) - num(media.element.trimStart, 0))));
      args.push('-i', media.source);
    }
    mediaIndexes.set(media.element.id, nextInput++);
  }

  const audioIndexes = [];
  for (const audio of audioTracks) {
    if (audio.track.loop) args.push('-stream_loop', '-1');
    args.push('-i', audio.source);
    audioIndexes.push(nextInput++);
  }
  let silenceIndex = null;
  if (!audioTracks.length) {
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration.toFixed(3)}`);
    silenceIndex = nextInput++;
  }

  const filters = ['[0:v]format=rgba[v0]'];
  let layerIndex = 0;
  let currentVideo = 'v0';
  const sorted = [...page.elements].filter((element) => !element.hidden).sort((a, b) => a.zIndex - b.zIndex);

  for (const element of sorted) {
    const nextVideo = `v${++layerIndex}`;
    const { x, y, width, height, scale } = mediaGeometry(element, page, output);
    const timing = elementWindow(element, duration);

    if (element.type === 'shape' || element.type === 'container') {
      if (element.type === 'shape' && element.shapeType !== 'rectangle') throw new Error(`Shape '${element.shapeType}' is not yet supported by template-engine-v1 (${element.id})`);
      const style = element.style ?? {};
      const fill = element.type === 'shape' ? style.fill : style.backgroundColor;
      filters.push(`[${currentVideo}]drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${cssColor(fill, 'white')}@${clamp(num(style.opacity, 1), 0, 1)}:t=fill:${timing}[${nextVideo}]`);
      currentVideo = nextVideo;
      continue;
    }

    if (element.type === 'text') {
      const style = element.style ?? {};
      const fontSize = Math.max(8, Math.round(num(style.fontSize, 48) * Math.min(scale.x, scale.y)));
      const textPath = path.join(pageWork, `text-${safeId(element.id)}.txt`);
      await writeFile(textPath, wrapText(element.content, width, fontSize), 'utf8');
      const lineSpacing = Math.max(0, Math.round(fontSize * (num(style.lineHeight, 1.15) - 1)));
      const parts = [
        `drawtext=fontfile=${FONT}`, `textfile=${esc(textPath)}`, `fontcolor=${cssColor(style.color)}@${clamp(num(style.opacity, 1), 0, 1)}`,
        `fontsize=${fontSize}`, `x=${x}`, `y=${y}`, `line_spacing=${lineSpacing}`,
      ];
      if (num(style.textStrokeWidth, 0) > 0) parts.push(`borderw=${Math.max(1, Math.round(num(style.textStrokeWidth)))}`, `bordercolor=${cssColor(style.textStrokeColor, '#000000')}`);
      if (style.backgroundColor && style.backgroundColor !== 'transparent') parts.push('box=1', `boxcolor=${cssColor(style.backgroundColor)}@0.85`, 'boxborderw=12');
      parts.push(timing);
      filters.push(`[${currentVideo}]${parts.join(':')}[${nextVideo}]`);
      currentVideo = nextVideo;
      continue;
    }

    if (element.type === 'image' || element.type === 'video') {
      const inputIndex = mediaIndexes.get(element.id);
      if (inputIndex == null) { filters.push(`[${currentVideo}]null[${nextVideo}]`); currentVideo = nextVideo; continue; }
      const mediaLabel = `media_${safeId(element.id)}`;
      const fit = mediaScaleFilter(width, height, String(element.style?.objectFit ?? 'cover'));
      const opacity = clamp(num(element.style?.opacity, 1), 0, 1);
      filters.push(`[${inputIndex}:v]${fit},setpts=PTS-STARTPTS,format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[${mediaLabel}]`);
      filters.push(`[${currentVideo}][${mediaLabel}]overlay=x=${x}:y=${y}:shortest=0:${timing}[${nextVideo}]`);
      currentVideo = nextVideo;
      continue;
    }

    if (element.type === 'waveform') {
      filters.push(`[${currentVideo}]null[${nextVideo}]`);
      currentVideo = nextVideo;
      continue;
    }
  }

  const narration = audioTracks.find((entry) => entry.narrationText);
  if (page.subtitle?.enabled && narration?.narrationText) {
    const srtPath = path.join(pageWork, 'captions.srt');
    await writeFile(srtPath, buildSrt(narration.narrationText, duration, page.subtitle.maxWordsPerLine ?? 4), 'utf8');
    const fontSize = Number.parseInt(String(page.subtitle.fontSize ?? '44px'), 10) || 44;
    const margin = Math.round(num(page.subtitle.offset, 120));
    const nextVideo = `v${++layerIndex}`;
    filters.push(`[${currentVideo}]subtitles=${esc(srtPath)}:force_style='FontName=DejaVu Sans,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H65000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=${margin}'[${nextVideo}]`);
    currentVideo = nextVideo;
  }
  filters.push(`[${currentVideo}]format=yuv420p[outv]`);

  let outputAudio;
  if (audioTracks.length) {
    const audioLabels = [];
    audioTracks.forEach((trackInfo, trackIndex) => {
      const label = `a${trackIndex}`;
      filters.push(audioFilterFor(trackInfo, audioIndexes[trackIndex], label, duration));
      audioLabels.push(`[${label}]`);
    });
    if (audioLabels.length === 1) {
      filters.push(`${audioLabels[0]}anull[outa]`);
    } else {
      filters.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0,alimiter=limit=0.95[outa]`);
    }
    outputAudio = '[outa]';
  } else {
    outputAudio = `${silenceIndex}:a`;
  }

  args.push(
    '-filter_complex', filters.join(';'), '-map', '[outv]', '-map', outputAudio,
    '-t', duration.toFixed(3), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', renderPath,
  );
  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 96 });
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
  if (pageFiles.length === 1) await execFileAsync('ffmpeg', ['-y', '-i', pageFiles[0], '-c', 'copy', '-movflags', '+faststart', outputFile]);
  else {
    const concatFile = path.join(workDir, 'pages.txt');
    await writeFile(concatFile, pageFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'), 'utf8');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', outputFile]);
  }

  const bytes = await readFile(outputFile);
  if (bytes.length < 10_000) throw new Error('Template renderer produced an unexpectedly small video file');
  return {
    outputFile, videoUrl: `/api/assets/${encodeURIComponent(`${jobId}.mp4`)}`,
    duration: totalDuration, bytes: bytes.length, engine: 'template-engine-v1', pages: document.pages.length,
    width: output.width, height: output.height,
  };
}
