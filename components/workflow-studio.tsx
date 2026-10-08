'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CapturedEvent = {
  id: string;
  kind: 'click' | 'input';
  atMs: number;
  label: string;
  target?: string;
};

type RenderResult = {
  sourceRevisionId: string;
  guideMarkdown: string;
  renderJobId: string;
  renderStatus: string;
  renderUrl: string;
  videoPlan: { scenes: Array<{ id: string; narration: string }> };
  cost: { estimatedTotal: number | null; hasUnknownRates: boolean };
};

type JobResult = {
  ok: boolean;
  data?: { status?: string; videoUrl?: string; error?: string };
  error?: string;
};

function selectorFor(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  if (element.getAttribute('name')) return `[name="${element.getAttribute('name')}"]`;
  return element.tagName.toLowerCase();
}

function labelFor(element: HTMLElement, fallback: string): string {
  return (
    element.dataset.workflowLabel ||
    element.getAttribute('aria-label') ||
    element.textContent?.trim() ||
    element.getAttribute('name') ||
    fallback
  ).slice(0, 180);
}

export function WorkflowStudio() {
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<CapturedEvent[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [busy, setBusy] = useState<'compile' | 'render' | null>(null);
  const [guide, setGuide] = useState('');
  const [revisionId, setRevisionId] = useState('');
  const [renderJobId, setRenderJobId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [sandboxMessage, setSandboxMessage] = useState('No member invited yet.');
  const startedAt = useRef(0);
  const captureId = useMemo(() => `capture-${Date.now().toString(36)}`, []);

  useEffect(() => {
    if (!recording) return;

    const record = (kind: CapturedEvent['kind'], element: HTMLElement, fallback: string) => {
      if (!element.closest('[data-workflow-capture-zone]')) return;
      const atMs = Math.max(0, Math.round(performance.now() - startedAt.current));
      setEvents((current) => [
        ...current,
        {
          id: `event-${current.length + 1}-${atMs}`,
          kind,
          atMs,
          label: labelFor(element, fallback),
          target: selectorFor(element),
        },
      ]);
      setDurationMs(atMs + 1200);
    };

    const click = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-workflow-label],button,a') : null;
      if (target) record('click', target, 'Click control');
    };
    const change = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target) record('input', target, 'Update field');
    };

    document.addEventListener('click', click, true);
    document.addEventListener('change', change, true);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('change', change, true);
    };
  }, [recording]);

  const start = () => {
    setError('');
    setGuide('');
    setRevisionId('');
    setRenderJobId('');
    setVideoUrl('');
    setEvents([]);
    setDurationMs(0);
    startedAt.current = performance.now();
    setRecording(true);
  };

  const stop = () => {
    setDurationMs((current) => Math.max(current, Math.round(performance.now() - startedAt.current), 2000));
    setRecording(false);
  };

  const payload = () => ({
    workflowId: 'invite-team-member',
    captureId,
    durationMs: Math.max(durationMs, 2000),
    events,
  });

  const compile = async () => {
    if (!events.length) {
      setError('Record at least one workflow action first.');
      return;
    }
    setBusy('compile');
    setError('');
    try {
      const response = await fetch('/api/v1/workflows/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'Workflow compile failed');
      setRevisionId(body.data.graph.revision.id);
      setGuide(
        body.data.guide.sections
          .map((section: { title: string; body: string }, index: number) => `## ${index + 1}. ${section.title}\n\n${section.body}`)
          .join('\n\n'),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Workflow compile failed');
    } finally {
      setBusy(null);
    }
  };

  const pollRender = async (url: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response = await fetch(url, { cache: 'no-store' });
      const body = (await response.json()) as JobResult;
      if (!response.ok || !body.ok) throw new Error(body.error || 'Unable to read render status');
      const status = body.data?.status?.toLowerCase();
      if (status === 'succeeded') {
        if (!body.data?.videoUrl) throw new Error('Render succeeded without a video URL');
        setVideoUrl(body.data.videoUrl);
        return;
      }
      if (status === 'failed' || status === 'cancelled') {
        throw new Error(body.data?.error || `Render ${status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Render did not reach a terminal state within the browser polling window');
  };

  const render = async () => {
    if (!events.length) {
      setError('Record at least one workflow action first.');
      return;
    }
    setBusy('render');
    setError('');
    setVideoUrl('');
    try {
      const response = await fetch('/api/v1/workflows/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'Workflow render failed');
      const result = body.data as RenderResult;
      setRevisionId(result.sourceRevisionId);
      setGuide(result.guideMarkdown);
      setRenderJobId(result.renderJobId);
      await pollRender(result.renderUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Workflow render failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel workflowStudio">
      <div className="panelHeader">
        <div>
          <div className="eyebrow">RE-375 · Workflow-to-training compiler</div>
          <h2>Record a workflow. Generate the SOP and training video from the same revision.</h2>
          <p className="muted">This rehearsal recorder intentionally captures action labels and selectors, not typed field values. The generated video uses the local FFmpeg + TTS renderer.</p>
        </div>
        <div className="status"><span className="dot" />{recording ? 'Recording actions' : 'Ready'}</div>
      </div>

      <div className="workflowActions">
        {!recording ? (
          <button className="button" onClick={start} disabled={busy !== null}>Start recording</button>
        ) : (
          <button className="button" onClick={stop}>Stop recording</button>
        )}
        <button className="button secondary" onClick={compile} disabled={recording || busy !== null || !events.length}>
          {busy === 'compile' ? 'Compiling…' : 'Compile SOP'}
        </button>
        <button className="button secondary" onClick={render} disabled={recording || busy !== null || !events.length}>
          {busy === 'render' ? 'Rendering…' : 'Generate training video'}
        </button>
      </div>

      <div className="workflowGrid">
        <div className="captureZone" data-workflow-capture-zone>
          <div className="eyebrow">Capture rehearsal</div>
          <h3>Invite a teammate</h3>
          <p className="muted">Start recording, then perform this miniature workflow in any order.</p>
          <button
            className="button ghost"
            data-workflow-label="Open team settings"
            onClick={() => setSandboxMessage('Team settings opened.')}
          >
            Open team settings
          </button>
          <label className="workflowField">
            Teammate email
            <input name="member-email" data-workflow-label="Enter teammate email" placeholder="teammate@example.com" />
          </label>
          <button
            className="button ghost"
            data-workflow-label="Invite teammate"
            onClick={() => setSandboxMessage('Invitation queued.')}
          >
            Invite teammate
          </button>
          <div className="successBox">{sandboxMessage}</div>
        </div>

        <div className="captureLog">
          <div className="eyebrow">Captured steps · {events.length}</div>
          {events.length === 0 ? <p className="muted">No actions captured yet.</p> : events.map((event, index) => (
            <div className="captureEvent" key={event.id}>
              <b>{index + 1}. {event.label}</b>
              <small>{event.kind} · {event.atMs} ms · {event.target}</small>
            </div>
          ))}
        </div>
      </div>

      {revisionId ? <div className="successBox">Source revision: <code>{revisionId}</code>{renderJobId ? <> · Render job: <code>{renderJobId}</code></> : null}</div> : null}
      {error ? <div className="errorBox">{error}</div> : null}
      {guide ? <details className="jobBox" open><summary>Generated SOP</summary><pre>{guide}</pre></details> : null}
      {videoUrl ? (
        <div className="workflowVideo">
          <div className="eyebrow">Generated training artifact</div>
          <video controls src={videoUrl} />
          <a className="button secondary" href={videoUrl} target="_blank" rel="noreferrer">Open MP4</a>
        </div>
      ) : null}
    </section>
  );
}
