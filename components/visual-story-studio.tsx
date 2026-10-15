'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MotionMode,
  VisualStoryFormat,
  VisualStoryItem,
  VisualStorySize,
  VisualStorySpec,
} from '@/lib/visual-story/types';
import styles from '@/app/visual-story/visual-story.module.css';

const SAMPLE_PROMPT = 'RAG pipeline: Ingest documents -> Chunk content -> Create embeddings -> Retrieve context -> Generate grounded answer';

const formatLabels: Array<[VisualStoryFormat, string]> = [
  ['process', 'Process'],
  ['roadmap', 'Roadmap'],
  ['comparison', 'Comparison'],
  ['stats', 'Stats'],
  ['architecture', 'Architecture'],
  ['listicle', 'Listicle'],
];

const motionLabels: Array<[MotionMode, string]> = [
  ['flow', 'Flow'],
  ['build', 'Build'],
  ['pulse', 'Pulse'],
];

const sizeLabels: Array<[VisualStorySize, string]> = [
  ['portrait', 'LinkedIn 4:5'],
  ['square', 'Square'],
  ['landscape', 'Landscape'],
];

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string, phase: number, animated: boolean) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y2 - 14);
  ctx.lineTo(x, y2);
  ctx.lineTo(x + 10, y2 - 14);
  ctx.stroke();
  if (animated) {
    const t = ((phase % 1) + 1) % 1;
    const dotY = y1 + (y2 - y1) * t;
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, dotY, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function itemAlpha(spec: VisualStorySpec, index: number, seconds: number): number {
  if (spec.motion !== 'build') return 1;
  const local = seconds - index * 0.55;
  return Math.max(0, Math.min(1, local / 0.45));
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  spec: VisualStorySpec,
  item: VisualStoryItem,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  seconds: number,
) {
  const alpha = itemAlpha(spec, index, seconds);
  if (alpha <= 0) return;
  const active = spec.motion === 'pulse' && Math.floor(seconds * 1.2) % Math.max(spec.items.length, 1) === index;
  const scale = active ? 1.018 : 1;
  const cx = x + width / 2;
  const cy = y + height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = 'rgba(255,255,255,0.075)';
  ctx.strokeStyle = active ? spec.brand.secondary : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = active ? 5 : 2;
  roundedRect(ctx, x, y, width, height, 26);
  ctx.fill();
  ctx.stroke();

  const badge = `${index + 1}`.padStart(2, '0');
  ctx.fillStyle = spec.brand.primary;
  roundedRect(ctx, x + 24, y + 24, 58, 42, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, x + 53, y + 45);

  if (item.value) {
    ctx.textAlign = 'right';
    ctx.fillStyle = spec.brand.secondary;
    ctx.font = '800 34px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(item.value, x + width - 28, y + 47);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = spec.brand.foreground;
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif';
  const labelLines = wrapText(ctx, item.label, width - 132, 2);
  labelLines.forEach((line, lineIndex) => ctx.fillText(line, x + 104, y + 52 + lineIndex * 35));

  if (item.detail) {
    ctx.fillStyle = 'rgba(247,248,252,0.68)';
    ctx.font = '400 22px ui-sans-serif, system-ui, sans-serif';
    const detailLines = wrapText(ctx, item.detail, width - 128, 2);
    detailLines.forEach((line, lineIndex) => ctx.fillText(line, x + 104, y + height - 42 + lineIndex * 26));
  }
  ctx.restore();
}

function drawStory(canvas: HTMLCanvasElement, spec: VisualStorySpec, now: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = spec;
  const seconds = (now / 1000) % 8;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = spec.brand.background;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.85, height * 0.1, 0, width * 0.85, height * 0.1, width * 0.75);
  glow.addColorStop(0, `${spec.brand.primary}44`);
  glow.addColorStop(0.55, `${spec.brand.secondary}16`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const margin = Math.round(width * 0.075);
  ctx.fillStyle = spec.brand.foreground;
  ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(spec.brand.name.toUpperCase(), margin, 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(247,248,252,0.66)';
  ctx.font = '500 20px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(spec.brand.handle, width - margin, 70);

  ctx.textAlign = 'left';
  ctx.fillStyle = spec.brand.foreground;
  ctx.font = `800 ${width < 900 ? 48 : 60}px ui-sans-serif, system-ui, sans-serif`;
  const titleLines = wrapText(ctx, spec.title, width - margin * 2, 3);
  titleLines.forEach((line, index) => ctx.fillText(line, margin, 150 + index * 70));

  const titleBottom = 150 + titleLines.length * 70;
  ctx.fillStyle = 'rgba(247,248,252,0.64)';
  ctx.font = '400 25px ui-sans-serif, system-ui, sans-serif';
  wrapText(ctx, spec.subtitle, width - margin * 2, 2).forEach((line, index) => ctx.fillText(line, margin, titleBottom + 10 + index * 32));

  const contentTop = titleBottom + 92;
  const contentBottom = height - 130;
  const availableHeight = Math.max(220, contentBottom - contentTop);
  const items = spec.items.slice(0, 8);

  if (spec.format === 'comparison' || spec.format === 'stats') {
    const columns = 2;
    const gap = 26;
    const cardWidth = (width - margin * 2 - gap) / columns;
    const rows = Math.ceil(items.length / columns);
    const cardHeight = Math.min(235, (availableHeight - gap * Math.max(rows - 1, 0)) / Math.max(rows, 1));
    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      drawCard(ctx, spec, item, index, margin + col * (cardWidth + gap), contentTop + row * (cardHeight + gap), cardWidth, cardHeight, seconds);
    });
  } else {
    const gap = Math.min(42, Math.max(18, availableHeight * 0.04));
    const cardHeight = Math.min(170, (availableHeight - gap * Math.max(items.length - 1, 0)) / Math.max(items.length, 1));
    const cardWidth = width - margin * 2;
    items.forEach((item, index) => {
      const y = contentTop + index * (cardHeight + gap);
      drawCard(ctx, spec, item, index, margin, y, cardWidth, cardHeight, seconds);
      if (index < items.length - 1) {
        const nextY = contentTop + (index + 1) * (cardHeight + gap);
        drawArrow(ctx, width / 2, y + cardHeight + 5, nextY - 5, spec.brand.secondary, seconds * 0.65 - index * 0.18, spec.motion === 'flow');
      }
    });
  }

  ctx.fillStyle = 'rgba(247,248,252,0.48)';
  ctx.font = '500 18px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${spec.format.toUpperCase()} · ${spec.motion.toUpperCase()} MOTION`, margin, height - 56);
  ctx.textAlign = 'right';
  ctx.fillText('Built with Visual Story Studio', width - margin, height - 56);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function VisualStoryStudio() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [format, setFormat] = useState<VisualStoryFormat | 'auto'>('auto');
  const [motion, setMotion] = useState<MotionMode>('flow');
  const [size, setSize] = useState<VisualStorySize>('portrait');
  const [brandName, setBrandName] = useState('Creator Studio');
  const [handle, setHandle] = useState('@creator');
  const [primary, setPrimary] = useState('#6D5EF9');
  const [secondary, setSecondary] = useState('#20C7A8');
  const [spec, setSpec] = useState<VisualStorySpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/visual-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...(format !== 'auto' ? { format } : {}),
          motion,
          size,
          brand: { name: brandName || 'Creator Studio', handle, primary, secondary },
        }),
      });
      const data = await response.json() as { story?: VisualStorySpec; error?: string };
      if (!response.ok || !data.story) throw new Error(data.error || 'Generation failed.');
      setSpec(data.story);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }, [brandName, format, handle, motion, primary, prompt, secondary, size]);

  useEffect(() => {
    void generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    canvas.width = spec.width;
    canvas.height = spec.height;
    let frame = 0;
    const tick = (time: number) => {
      drawStory(canvas, spec, time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spec]);

  const updateItem = (index: number, patch: Partial<VisualStoryItem>) => {
    setSpec((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    drawStory(canvas, spec, 3200);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `visual-story-${spec.id}.png`), 'image/png');
  };

  const exportJson = () => {
    if (!spec) return;
    downloadBlob(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), `visual-story-${spec.id}.json`);
  };

  const exportAnimation = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !spec || typeof MediaRecorder === 'undefined') {
      setError('Animated browser export is not supported by this browser. PNG and JSON exports still work.');
      return;
    }
    const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      setError('This browser does not expose a supported animated recording codec.');
      return;
    }

    setExporting(true);
    setError('');
    try {
      const stream = canvas.captureStream(30);
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start(250);
      window.setTimeout(() => recorder.stop(), 5200);
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(new Blob(chunks, { type: mimeType }), `visual-story-${spec.id}.${extension}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Animated export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.eyebrow}>REA · Visual Story Studio</div>
          <h1>Prompt → story → motion.</h1>
          <p className={styles.muted}>Create source-grounded animated LinkedIn visuals with an owned spec, renderer and export path.</p>
        </div>

        <label className={styles.field}>
          <span>What should the visual explain?</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={4000} />
        </label>

        <div className={styles.twoCol}>
          <label className={styles.field}><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value as VisualStoryFormat | 'auto')}><option value="auto">Auto</option>{formatLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.field}><span>Motion</span><select value={motion} onChange={(event) => setMotion(event.target.value as MotionMode)}>{motionLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <label className={styles.field}><span>Canvas</span><select value={size} onChange={(event) => setSize(event.target.value as VisualStorySize)}>{sizeLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

        <div className={styles.brandPanel}>
          <div className={styles.eyebrow}>Brand kit</div>
          <div className={styles.twoCol}>
            <label className={styles.field}><span>Name</span><input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></label>
            <label className={styles.field}><span>Handle</span><input value={handle} onChange={(event) => setHandle(event.target.value)} /></label>
          </div>
          <div className={styles.colorRow}>
            <label><span>Primary</span><input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} /></label>
            <label><span>Accent</span><input type="color" value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label>
          </div>
        </div>

        <button className={styles.primaryButton} type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>{busy ? 'Planning…' : 'Generate visual story'}</button>
        {error ? <div className={styles.error}>{error}</div> : null}
      </aside>

      <main className={styles.stage}>
        <div className={styles.stageTop}>
          <div>
            <div className={styles.eyebrow}>Live artboard</div>
            <div className={styles.statusLine}>{spec ? `${spec.width}×${spec.height} · ${spec.provenance.mode} planner · source-only claims` : 'Generating…'}</div>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={exportPng} disabled={!spec}>PNG</button>
            <button type="button" onClick={() => void exportAnimation()} disabled={!spec || exporting}>{exporting ? 'Recording…' : 'Animation'}</button>
            <button type="button" onClick={exportJson} disabled={!spec}>Spec JSON</button>
          </div>
        </div>

        <div className={styles.canvasFrame}>
          <canvas ref={canvasRef} className={styles.canvas} aria-label="Animated visual story preview" />
        </div>

        {spec ? <section className={styles.editor}>
          <div className={styles.editorHeader}><div><div className={styles.eyebrow}>Editable story</div><h2>Change the content, not the canvas.</h2></div><span className={styles.chip}>{spec.format} · {spec.motion}</span></div>
          <label className={styles.field}><span>Headline</span><input value={spec.title} onChange={(event) => setSpec({ ...spec, title: event.target.value })} /></label>
          <div className={styles.itemList}>{spec.items.map((item, index) => <div className={styles.itemEditor} key={item.id}><b>{String(index + 1).padStart(2, '0')}</b><input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /><input value={item.detail} placeholder="Optional detail" onChange={(event) => updateItem(index, { detail: event.target.value })} /></div>)}</div>
        </section> : null}
      </main>
    </div>
  );
}
