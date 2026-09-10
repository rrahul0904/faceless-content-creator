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

export function Creator() {
  const [niche, setNiche] = useState('Artificial intelligence');
  const [idea, setIdea] = useState('Why AI agents need memory');
  const [result, setResult] = useState<Script | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStage('Writing script');
    setError('');
    setJob(null);
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

  async function render() {
    if (!result) return;
    setBusy(true);
    setError('');
    setJob(null);
    try {
      setStage('Generating presenter');
      const presenterRes = await fetch('/api/presenter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: result.script }),
      });
      const presenterData = await presenterRes.json();
      if (!presenterRes.ok) throw new Error(presenterData.error ?? 'Presenter generation failed');
      const clipUrl = presenterData.presenter?.url;
      if (!clipUrl) throw new Error('Presenter generation returned no video URL');

      setStage('Starting final render');
      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, clipUrl }),
      });
      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error ?? 'Render failed to start');
      setJob(renderData.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Video generation failed');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  return (
    <section className="panel creatorPanel">
      <div className="panelHeader">
        <div><div className="eyebrow">Studio</div><h2>Create a short</h2></div>
        {stage && <div className="status"><span className="dot" />{stage}</div>}
      </div>
      <form className="creatorForm" onSubmit={generate}>
        <label>Niche<input value={niche} onChange={(e) => setNiche(e.target.value)} /></label>
        <label>Idea<textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} /></label>
        <button className="button" disabled={busy}>{busy ? 'Working…' : 'Generate script'}</button>
      </form>
      {error && <div className="errorBox">{error}</div>}
      {result && <div className="resultCard"><div className="eyebrow">Generated draft</div><h3>{result.hook}</h3><p className="muted">{result.script}</p><p>{result.caption}</p><button className="button secondary" onClick={render} disabled={busy}>{busy ? stage || 'Working…' : 'Generate presenter + render'}</button></div>}
      {job && <pre className="jobBox">{JSON.stringify(job, null, 2)}</pre>}
    </section>
  );
}
