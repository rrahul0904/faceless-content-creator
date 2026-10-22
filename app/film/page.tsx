'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import './film.css';
import { resolveFilmFrame } from '../../lib/agent-film/timeline.mjs';

type Bounds = { x: number; y: number; width: number; height: number };
type Layer = { id: string; type: string; text?: string; fill?: string; color?: string; fontSize?: number; bounds: Bounds; start?: number; end?: number };
type Scene = { id: string; name?: string; duration: number; background?: string; narration?: string; layers: Layer[] };
type Plan = { name: string; format?: string; scenes: Scene[] };
type FilmResponse = { ok: boolean; error?: string; data?: { duration: number; sceneCount: number; planHash: string; templateId?: string; studioUrl?: string; renderJobId?: string } };

const starter = {
  name: 'Agent Work OS — Build at the speed of thought',
  format: 'portrait',
  scenes: [
    {
      id: 'hook', name: 'Hook', duration: 6, background: '#101820',
      narration: 'What if you could turn a single idea into a finished video?',
      layers: [
        { id: 'accent', type: 'shape', fill: '#D7FF64', start: 0, end: 6, bounds: { x: 0.08, y: 0.12, width: 0.84, height: 0.02 } },
        { id: 'headline', type: 'text', text: 'FROM IDEA\nTO VIDEO.', color: '#FFFFFF', fontSize: 96, start: 0.3, end: 5.8, bounds: { x: 0.08, y: 0.3, width: 0.84, height: 0.35 } },
      ],
    },
    {
      id: 'proof', name: 'The workflow', duration: 6, background: '#162336',
      narration: 'Let the agent draft. Make it yours in the Studio. Render when you are ready.',
      layers: [
        { id: 'line', type: 'shape', fill: '#55D6BE', start: 0, end: 6, bounds: { x: 0.08, y: 0.19, width: 0.12, height: 0.02 } },
        { id: 'proof_text', type: 'text', text: 'DRAFT.\nEDIT.\nRENDER.', color: '#FFFFFF', fontSize: 84, start: 0, end: 5.7, bounds: { x: 0.08, y: 0.28, width: 0.84, height: 0.45 } },
      ],
    },
  ],
};

const initial = JSON.stringify(starter, null, 2);

function sceneSeconds(scenes: Scene[], index: number) {
  return scenes.slice(0, index).reduce((total, scene) => total + (Number(scene.duration) || 0), 0);
}

export default function AgentFilmPage() {
  const [source, setSource] = useState(initial);
  const [idea, setIdea] = useState('Explain how an autonomous agent builds and checks a video');
  const [niche, setNiche] = useState('AI tools');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selected, setSelected] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready to validate your storyboard.');
  const [result, setResult] = useState<FilmResponse['data'] | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const plan = useMemo<Plan | null>(() => {
    try {
      const p: unknown = JSON.parse(source);
      if (p && typeof p === 'object' && 'scenes' in p && Array.isArray(p.scenes)) return p as Plan;
    } catch {}
    return null;
  }, [source]);

  const scenes = plan?.scenes ?? [];
  const scene = scenes[selected] ?? scenes[0];
  const totalDuration = scenes.reduce((total, item) => total + (Number(item.duration) || 0), 0);
  const frame = resolveFilmFrame(scenes, playhead);
  const activeLayers = new Set(frame.sceneIndex === selected ? frame.visibleLayerIds : []);
  const ratio = plan?.format === 'landscape' ? '16 / 9' : plan?.format === 'square' ? '1' : '9 / 16';

  async function draftFromIdea() {
    setBusy(true); setMessage('Drafting script from the configured content service…');
    setResult(null); setVideoUrl('');
    try {
      const response = await fetch('/api/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, niche }),
      });
      const body = await response.json() as { ok: boolean; error?: string; result?: { hook: string; script: string; topic: string } };
      if (!response.ok || !body.result) throw new Error(body.error || 'Script service failed');
      const sentences = (body.result.script.match(/[^.!?]+[.!?]?/g) ?? []).map((line) => line.trim()).filter(Boolean);
      const beats = [body.result.hook, ...sentences].filter(Boolean).slice(0, 8);
      const freshPlan: Plan = {
        name: body.result.topic.slice(0, 120) || 'New video', format: 'portrait',
        scenes: beats.map((beat, index) => {
          const words = beat.split(/\s+/).length;
          const duration = Math.min(25, Math.max(4, Math.ceil(words / 2.5) + 2));
          return {
            id: 'beat_' + (index + 1), name: index === 0 ? 'Hook' : 'Beat ' + index,
            duration, background: index % 2 ? '#14233A' : '#101820', narration: beat.slice(0, 2000),
            layers: [
              { id: 'accent_' + index, type: 'shape', fill: '#D7FF64',
                start: 0, end: duration, bounds: { x: 0.09, y: 0.22, width: 0.2, height: 0.016 } },
              { id: 'copy_' + index, type: 'text', text: beat.slice(0, 4000), color: '#FFFFFF',
                fontSize: 68, start: 0, end: duration,
                bounds: { x: 0.09, y: 0.32, width: 0.82, height: 0.46 } },
            ],
          };
        }),
      };
      if (!freshPlan.scenes.length) throw new Error('Script service returned no storyboard beats');
      setSource(JSON.stringify(freshPlan, null, 2));
      setSelected(0); setPlayhead(0); setSelectedLayer('');
      setMessage('Draft ready. Select any scene or text layer to refine it, then validate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to draft video');
    } finally { setBusy(false); }
  }

  function changeLayer(property: 'text' | 'color' | 'fill' | 'start' | 'end', value: string | number) {
    try {
      const next = JSON.parse(source) as Plan;
      const chosen = next.scenes?.[selected]?.layers?.find((item) => item.id === selectedLayer);
      if (!chosen) return;
      if (property === 'text') chosen.text = String(value);
      if (property === 'color') chosen.color = String(value);
      if (property === 'fill') chosen.fill = String(value);
      if (property === 'start') chosen.start = Number(value);
      if (property === 'end') chosen.end = Number(value);
      setSource(JSON.stringify(next, null, 2));
      setResult(null);
    } catch { setMessage('Fix JSON syntax before editing in the inspector.'); }
  }

  const currentLayer = scene?.layers?.find((item) => item.id === selectedLayer);

  async function submit(mode: 'validate' | 'save' | 'render') {
    setBusy(true); setResult(null); setVideoUrl('');
    setMessage(mode === 'render' ? 'Creating and queueing film…' : 'Validating storyboard…');
    try {
      const payload = JSON.parse(source);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey.trim()) headers.Authorization = 'Bearer ' + apiKey.trim();
      const response = await fetch('/api/v1/agent-films', {
        method: 'POST', headers,
        body: JSON.stringify({ plan: payload, dryRun: mode === 'validate', render: mode === 'render' }),
      });
      const body = await response.json() as FilmResponse;
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error || 'Film request failed');
      setResult(body.data);
      if (mode === 'validate') { setMessage('Valid. This plan can become an editable Studio template.'); return; }
      setMessage('Film saved as an editable Studio template.');
      if (body.data.renderJobId) {
        setMessage('Render queued — checking job…');
        for (let attempt = 0; attempt < 120; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const jobResponse = await fetch('/api/v1/render-jobs/' + encodeURIComponent(body.data.renderJobId), { headers });
          const job = await jobResponse.json();
          if (!jobResponse.ok) throw new Error(job.error || 'Cannot read render status');
          if (!job.data?.finished) { setMessage('Render in progress…'); continue; }
          if (job.data.status !== 'succeeded') throw new Error(job.data.error || 'Render failed');
          setVideoUrl(job.data.result.url);
          setMessage('MP4 ready. You can still edit the source template in Studio.');
          return;
        }
        setMessage('Render is still running; check the render jobs page later.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to process storyboard');
    } finally {
      setBusy(false);
    }
  }

  return <main className="filmShell">
    <header className="filmHeader">
      <div><Link href="/" className="filmBack">← Creator Console</Link><h1>Agent Film Studio</h1><p>FilmPlan v1 — code-generated ideas, human-editable videos.</p></div>
      <Link href="/studio" className="filmStudioLink">Open template Studio ↗</Link>
    </header>

    <section className="filmWorkspace">
      <div className="filmEditor">
        <div className="filmSectionHeader"><h2>Storyboard specification</h2><span>JSON · v1</span></div>
        <p className="filmHint">Your coding agent can produce this plan. Edit the scenes and layer properties here, validate it, then save it as a versioned template.</p>
        <div className="filmPrompt">
          <label>Topic or instruction<input value={idea} maxLength={500} onChange={(event) => setIdea(event.target.value)} /></label>
          <label>Content niche<input value={niche} maxLength={120} onChange={(event) => setNiche(event.target.value)} /></label>
          <button disabled={busy || !idea.trim()} onClick={() => void draftFromIdea()}>Draft storyboard from idea</button>
          <small>Uses the existing content service: configured LLM if available, otherwise a local deterministic draft. Review generated claims before publishing.</small>
        </div>
        <textarea aria-label="FilmPlan JSON storyboard" spellCheck={false} value={source} onChange={(event) => { setSource(event.target.value); setSelected(0); setPlayhead(0); setSelectedLayer(''); setResult(null); }} />
        <details><summary>Hosted workspace credentials</summary><label className="filmAuth">Workspace API key (optional in local mode)<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label></details>
        <div className="filmButtons">
          <button disabled={busy} onClick={() => void submit('validate')} className="filmSecondary">Validate</button>
          <button disabled={busy} onClick={() => void submit('save')} className="filmSecondary">Save editable film</button>
          <button disabled={busy} onClick={() => void submit('render')}>{busy ? 'Working…' : 'Save + render MP4'}</button>
        </div>
        <p className="filmStatus" role="status">{message}</p>
        {result && <div className="filmResult"><strong>{result.sceneCount} scenes · {result.duration}s</strong><span>Spec SHA-256: {result.planHash}</span>{result.templateId && <Link href="/studio">Edit your saved film in Studio ↗</Link>}</div>}
      </div>

      <div className="filmPreview">
        <div className="filmSectionHeader"><h2>Visual storyboard</h2><span>{totalDuration.toFixed(1)} sec</span></div>
        <div className="filmScenePicker" aria-label="Choose scene">
          {scenes.map((item, index) => <button key={item.id + index} onClick={() => { setSelected(index); setPlayhead(sceneSeconds(scenes, index)); setSelectedLayer(''); }} className={selected === index ? 'selected' : ''}>
            <small>{sceneSeconds(scenes, index).toFixed(1)}s</small>
            <strong>{item.name || item.id}</strong>
            <small>{item.duration}s</small>
          </button>)}
        </div>
        <div className="filmTimeline" style={{ padding: '12px 0' }}>
          <label htmlFor="film-playhead">Inspect at {frame.time.toFixed(1)}s of {totalDuration.toFixed(1)}s</label>
          <input id="film-playhead" aria-label="Scrub storyboard timeline" type="range" min={0} max={Math.max(totalDuration, 0.1)} step={0.1} value={Math.min(playhead, totalDuration)} disabled={!totalDuration} style={{ display: 'block', width: '100%', marginTop: 8 }} onChange={(event) => {
            const next = resolveFilmFrame(scenes, Number(event.target.value));
            setPlayhead(next.time); setSelected(next.sceneIndex); setSelectedLayer('');
          }} />
          <small>Scene {scenes.length ? frame.sceneIndex + 1 : 0}/{scenes.length} · {frame.localTime.toFixed(1)}s into this scene</small>
        </div>
        {scene ? <div className="filmCanvasOuter"><div className="filmCanvas" style={{ aspectRatio: ratio, backgroundColor: scene.background || '#0B0D10' }}>
          {scene.layers?.map((layer, index) => {
            if (!layer.bounds || !activeLayers.has(layer.id)) return null;
            const style = {
              position: 'absolute' as const, zIndex: index + 1,
              left: (layer.bounds.x * 100) + '%', top: (layer.bounds.y * 100) + '%',
              width: (layer.bounds.width * 100) + '%', height: (layer.bounds.height * 100) + '%',
              display: 'flex', overflow: 'hidden',
            };
            if (layer.type === 'shape') return <button type="button" aria-label={'Edit layer ' + layer.id} key={layer.id + index} onClick={() => setSelectedLayer(layer.id)} style={{ ...style, cursor: 'pointer', border: selectedLayer === layer.id ? '2px dotted white' : '2px solid transparent', background: layer.fill || '#D7FF64' }} />;
            if (layer.type === 'text') return <button type="button" aria-label={'Edit text ' + layer.id} onClick={() => setSelectedLayer(layer.id)} key={layer.id + index} style={{ ...style, cursor: 'pointer', textAlign: 'left', padding: 0, background: 'transparent', border: selectedLayer === layer.id ? '2px dotted #D7FF64' : '2px solid transparent', whiteSpace: 'pre-line', color: layer.color || '#FFFFFF', fontSize: 'clamp(8px, ' + ((layer.fontSize || 74) / 4) + 'px, 32px)', lineHeight: 1.1, fontWeight: 800, alignItems: 'center' }}>{layer.text}</button>;
            return null;
          })}
        </div></div> : <div className="filmEmpty">Enter a valid JSON storyboard to preview scenes.</div>}
        {currentLayer && <div className="filmInspector">
          <h3>Edit selected layer · {currentLayer.id}</h3>
          {currentLayer.type === 'text' && <label>Text<textarea value={currentLayer.text || ''} onChange={(event) => changeLayer('text', event.target.value)} /></label>}
          <label>Color<input type="color" value={currentLayer.type === 'shape' ? currentLayer.fill || '#D7FF64' : currentLayer.color || '#FFFFFF'} onChange={(event) => changeLayer(currentLayer.type === 'shape' ? 'fill' : 'color', event.target.value)} /></label>
          <div className="filmInspectorTimes">
            <label>Start (sec)<input type="number" min="0" max={scene.duration} step="0.1" value={currentLayer.start ?? 0} onChange={(event) => changeLayer('start', Number(event.target.value))} /></label>
            <label>End (sec)<input type="number" min="0" max={scene.duration} step="0.1" value={currentLayer.end ?? scene.duration} onChange={(event) => changeLayer('end', Number(event.target.value))} /></label>
          </div>
        </div>}
        {scene?.narration && <p className="filmNarration"><strong>Narration</strong> {scene.narration}</p>}
        {videoUrl && <div className="filmVideo"><h3>Rendered MP4</h3><video src={videoUrl} controls playsInline /><a href={videoUrl} target="_blank" rel="noreferrer">Open MP4 ↗</a></div>}
        <p className="filmHint">Timeline scrubbing respects scene cuts and layer start/end times. Layout is approximate; rendered MP4 is produced by the existing FFmpeg pipeline and pixel-level preview parity is not yet certified.</p>
      </div>
    </section>
  </main>;
}
