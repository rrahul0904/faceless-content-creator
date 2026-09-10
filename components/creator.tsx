'use client';

import { FormEvent, useState } from 'react';

type Script = {
  topic: string;
  hook: string;
  script: string;
  caption: string;
  statNumber?: string;
  statLabel?: string;
};

type RenderJob = {
  id: string;
  status: string;
  finished: boolean;
  result?: { data?: { content?: string } };
  error?: unknown;
  engine?: string;
};

const voices = [
  ['en-us', 'US English'],
  ['en-gb', 'British English'],
  ['en-sc', 'Scottish English'],
  ['en-westindies', 'Caribbean English'],
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Creator() {
  const [niche, setNiche] = useState('Artificial intelligence');
  const [idea, setIdea] = useState('Why AI agents need memory');
  const [voice, setVoice] = useState('en-us');
  const [speechRate, setSpeechRate] = useState(165);
  const [result, setResult] = useState<Script | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStage('Writing script');
    setError('');
    setJob(null);
    setVideoUrl('');
    setCopied(false);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Script generation failed');
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Script generation failed');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function pollRender(id: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      setStage(attempt < 2 ? 'Starting local renderer' : 'Rendering locally with FFmpeg');
      await sleep(1500);
      const statusRes = await fetch(`/api/render/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const statusData = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusData.error ?? 'Unable to check render status');
      const current = statusData.job as RenderJob;
      setJob(current);
      if (!current.finished) continue;
      if (current.status !== 'succeeded') {
        throw new Error(`Render ${current.status}${current.error ? `: ${String(current.error)}` : ''}`);
      }
      const renderedUrl = current.result?.data?.content;
      if (!renderedUrl) throw new Error('Render finished without a video URL');
      setVideoUrl(renderedUrl);
      return;
    }
    throw new Error('Local render exceeded the expected time. The render job can still be checked from its job id.');
  }

  async function render() {
    if (!result) return;
    setBusy(true);
    setError('');
    setJob(null);
    setVideoUrl('');
    setCopied(false);
    try {
      setStage('Queueing local render');
      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, voice, speechRate }),
      });
      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error ?? 'Render failed to start');
      const started = renderData.job as RenderJob;
      setJob(started);
      await pollRender(started.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Video generation failed');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function copyCaption() {
    if (!result) return;
    await navigator.clipboard.writeText(result.caption);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="panel creatorPanel">
      <div className="panelHeader">
        <div>
          <div className="eyebrow">Local Studio</div>
          <h2>Create a short without API keys</h2>
        </div>
        <div className="status"><span className="dot" />FFmpeg + local TTS</div>
      </div>

      <form className="creatorForm localCreatorForm" onSubmit={generate}>
        <label>Niche<input value={niche} onChange={(e) => setNiche(e.target.value)} /></label>
        <label>Idea<textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} /></label>
        <label>Voice<select value={voice} onChange={(e) => setVoice(e.target.value)}>{voices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Speed<input type="range" min="110" max="230" value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))} /><span className="rangeValue">{speechRate} wpm</span></label>
        <button className="button" disabled={busy}>{busy ? 'Working…' : 'Generate script'}</button>
      </form>

      {stage && <div className="renderProgress"><span className="dot" />{stage}</div>}
      {error && <div className="errorBox">{error}</div>}

      {result && (
        <div className="resultCard">
          <div className="eyebrow">Generated draft</div>
          <h3>{result.hook}</h3>
          <p className="muted">{result.script}</p>
          <p>{result.caption}</p>
          <div className="ctaRow">
            <button className="button secondary" onClick={render} disabled={busy}>{busy ? stage || 'Working…' : 'Render locally'}</button>
            <button className="button ghost" type="button" onClick={copyCaption}>{copied ? 'Copied' : 'Copy caption'}</button>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="videoResult">
          <div>
            <div className="eyebrow">Ready for review</div>
            <h3>Rendered entirely on this machine.</h3>
          </div>
          <video src={videoUrl} controls playsInline />
          <div className="ctaRow">
            <a className="button" href={videoUrl} download>Download MP4</a>
            <a className="button secondary" href={videoUrl} target="_blank" rel="noreferrer">Open video</a>
          </div>
          <p className="muted zeroConfigNote">No Orshot request, render template ID, presenter image, callback URL, webhook secret or database connection string was used.</p>
        </div>
      )}

      {job && (
        <details className="jobBox">
          <summary>Local render job {job.id} · {job.status}</summary>
          <pre>{JSON.stringify(job, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
