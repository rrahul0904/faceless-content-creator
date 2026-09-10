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
  const [error, setError] = useState('');

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
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
    }
  }

  async function render() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Render failed to start');
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed to start');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel creatorPanel">
      <div className="panelHeader">
        <div><div className="eyebrow">Studio</div><h2>Create a short</h2></div>
      </div>
      <form className="creatorForm" onSubmit={generate}>
        <label>Niche<input value={niche} onChange={(e) => setNiche(e.target.value)} /></label>
        <label>Idea<textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} /></label>
        <button className="button" disabled={busy}>{busy ? 'Working…' : 'Generate script'}</button>
      </form>
      {error && <div className="errorBox">{error}</div>}
      {result && <div className="resultCard"><div className="eyebrow">Generated draft</div><h3>{result.hook}</h3><p className="muted">{result.script}</p><p>{result.caption}</p><button className="button secondary" onClick={render} disabled={busy}>Render video</button></div>}
      {job && <pre className="jobBox">{JSON.stringify(job, null, 2)}</pre>}
    </section>
  );
}
