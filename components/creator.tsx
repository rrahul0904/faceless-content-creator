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
  id: number;
  status: string;
  finished: boolean;
  result?: { data?: { content?: string } };
  error?: unknown;
};

type SocialAccount = {
  id: number;
  platform: string;
  account_name?: string;
  account_username?: string;
  requires_reconnect?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Creator() {
  const [niche, setNiche] = useState('Artificial intelligence');
  const [idea, setIdea] = useState('Why AI agents need memory');
  const [result, setResult] = useState<Script | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [publishResult, setPublishResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  async function loadAccounts() {
    const res = await fetch('/api/social/accounts', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Unable to load connected social accounts');
    const nextAccounts = (data.accounts ?? []) as SocialAccount[];
    setAccounts(nextAccounts);
    setSelectedAccounts(nextAccounts.filter((account) => !account.requires_reconnect).map((account) => account.id));
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStage('Writing script');
    setError('');
    setJob(null);
    setVideoUrl('');
    setAccounts([]);
    setSelectedAccounts([]);
    setPublishResult('');
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

  async function pollRender(id: number) {
    for (let attempt = 0; attempt < 72; attempt += 1) {
      setStage(`Rendering video · check ${attempt + 1}`);
      await sleep(5000);
      const statusRes = await fetch(`/api/render/${id}`, { cache: 'no-store' });
      const statusData = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusData.error ?? 'Unable to check render status');
      const current = statusData.job as RenderJob;
      setJob(current);
      if (!current.finished) continue;
      if (current.status !== 'succeeded') {
        throw new Error(`Render ${current.status}${current.error ? `: ${JSON.stringify(current.error)}` : ''}`);
      }
      const renderedUrl = current.result?.data?.content;
      if (!renderedUrl) throw new Error('Render finished without a video URL');
      setVideoUrl(renderedUrl);
      setStage('Loading social accounts');
      await loadAccounts();
      return;
    }
    throw new Error('Render is still processing. Use the job id shown below to check it again later.');
  }

  async function render() {
    if (!result) return;
    setBusy(true);
    setError('');
    setJob(null);
    setVideoUrl('');
    setAccounts([]);
    setPublishResult('');
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

  function toggleAccount(id: number) {
    setSelectedAccounts((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function publish(draft: boolean) {
    if (!result || !videoUrl || selectedAccounts.length === 0) return;
    if (!draft && !window.confirm('Publish this video now to the selected social accounts?')) return;
    setBusy(true);
    setStage(draft ? 'Creating social draft' : 'Publishing now');
    setError('');
    setPublishResult('');
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          caption: result.caption,
          accountIds: selectedAccounts,
          draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Publishing failed');
      setPublishResult(draft ? 'Social draft created successfully.' : 'Video submitted for publishing successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publishing failed');
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
      {videoUrl && <div className="videoResult"><div className="eyebrow">Ready for review</div><video src={videoUrl} controls playsInline /><a className="button secondary" href={videoUrl} target="_blank" rel="noreferrer">Open rendered MP4</a>{accounts.length > 0 ? <div className="publishPanel"><strong>Publish to</strong><div className="accountGrid">{accounts.map((account) => <label className={`accountCard ${account.requires_reconnect ? 'accountDisabled' : ''}`} key={account.id}><input type="checkbox" disabled={account.requires_reconnect || busy} checked={selectedAccounts.includes(account.id)} onChange={() => toggleAccount(account.id)} /><span><b>{account.platform}</b><small>{account.account_username ?? account.account_name ?? `Account ${account.id}`}{account.requires_reconnect ? ' · reconnect required' : ''}</small></span></label>)}</div><div className="ctaRow"><button className="button secondary" disabled={busy || selectedAccounts.length === 0} onClick={() => publish(true)}>Save social draft</button><button className="button" disabled={busy || selectedAccounts.length === 0} onClick={() => publish(false)}>Publish now</button></div></div> : <p className="muted">No connected social accounts were returned. Connect an account in Orshot before publishing.</p>}{publishResult && <div className="successBox">{publishResult}</div>}</div>}
      {job && <details className="jobBox"><summary>Render job {job.id} · {job.status}</summary><pre>{JSON.stringify(job, null, 2)}</pre></details>}
    </section>
  );
}
