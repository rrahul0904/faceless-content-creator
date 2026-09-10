'use client';

import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

type ElementType = 'text' | 'image' | 'shape' | 'video' | 'waveform' | 'container';

type StudioElement = {
  id: string;
  type: ElementType;
  name?: string;
  content?: string;
  shapeType?: string;
  position: { x: number; y: number };
  dimensions: { width: number | 'auto'; height: number | 'auto' };
  zIndex: number;
  hidden: boolean;
  locked: boolean;
  parameterizable: boolean;
  parameterId?: string;
  style: Record<string, unknown>;
};

type StudioPage = {
  id: string;
  name: string;
  canvas: { width: number; height: number; backgroundColor: string; backgroundImage: string };
  elements: StudioElement[];
};

type StudioDocument = {
  schemaVersion: 1;
  name: string;
  description: string;
  tags: string[];
  canvasWidth: number;
  canvasHeight: number;
  pages: StudioPage[];
  variants: Array<{ id: string; name: string; width: number; height: number; mode: string }>;
};

type TemplateRecord = {
  id: string;
  name: string;
  version: number;
  document: StudioDocument & {
    modifications?: Array<{ key: string; type: string; description: string; example: string }>;
  };
};

type DragState = { id: string; startClientX: number; startClientY: number; startX: number; startY: number } | null;

const PREVIEW_WIDTH = 405;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function elementLabel(element: StudioElement) {
  return element.name || element.content?.slice(0, 26) || element.id;
}

export function TemplateStudio() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [document, setDocument] = useState<StudioDocument | null>(null);
  const [version, setVersion] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [status, setStatus] = useState('Loading template engine…');
  const [renderUrl, setRenderUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const dragRef = useRef<DragState>(null);

  async function getJson(url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`);
    return body;
  }

  async function loadTemplates(preferredId?: string) {
    let body = await getJson('/api/v1/templates');
    if (!body.data?.length) {
      await getJson('/api/v1/templates/bootstrap', { method: 'POST' });
      body = await getJson('/api/v1/templates');
    }
    const records = body.data as TemplateRecord[];
    setTemplates(records);
    const id = preferredId || records[0]?.id || '';
    if (id) await loadTemplate(id);
    else setStatus('No templates available');
  }

  async function loadTemplate(id: string) {
    setStatus('Loading template…');
    const body = await getJson(`/api/v1/templates/${encodeURIComponent(id)}`);
    const record = body.data as TemplateRecord;
    setTemplateId(record.id);
    setDocument(deepClone(record.document));
    setVersion(record.version || 1);
    setPageIndex(0);
    setSelectedId(record.document.pages?.[0]?.elements?.[0]?.id || '');
    setRenderUrl('');
    setStatus(`Version ${record.version || 1} loaded`);
  }

  useEffect(() => {
    void loadTemplates().catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load templates'));
  }, []);

  const page = document?.pages[pageIndex];
  const scale = page ? PREVIEW_WIDTH / page.canvas.width : 1;
  const previewHeight = page ? page.canvas.height * scale : 720;
  const selected = page?.elements.find((element) => element.id === selectedId) || null;
  const modifications = useMemo(() => {
    if (!document) return [];
    const rows: Array<{ key: string; element: StudioElement }> = [];
    document.pages.forEach((docPage, index) => {
      docPage.elements.forEach((element) => {
        if (element.parameterizable && element.parameterId) {
          rows.push({ key: `${index === 0 ? '' : `page${index + 1}@`}${element.parameterId}`, element });
        }
      });
    });
    return rows;
  }, [document]);

  function updateDocument(updater: (draft: StudioDocument) => void) {
    setDocument((current) => {
      if (!current) return current;
      const next = deepClone(current);
      updater(next);
      return next;
    });
  }

  function updateSelected(mutator: (element: StudioElement) => void) {
    updateDocument((draft) => {
      const element = draft.pages[pageIndex]?.elements.find((item) => item.id === selectedId);
      if (element) mutator(element);
    });
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>, element: StudioElement) {
    if (element.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: element.position.x,
      startY: element.position.y,
    };
    setSelectedId(element.id);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current || current.id !== event.currentTarget.dataset.elementId) return;
    const dx = (event.clientX - current.startClientX) / scale;
    const dy = (event.clientY - current.startClientY) / scale;
    updateDocument((draft) => {
      const element = draft.pages[pageIndex]?.elements.find((item) => item.id === current.id);
      if (!element) return;
      element.position.x = Math.round(current.startX + dx);
      element.position.y = Math.round(current.startY + dy);
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  async function save() {
    if (!document || !templateId) return;
    setStatus('Saving version…');
    const body = await getJson(`/api/v1/templates/${encodeURIComponent(templateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: document }),
    });
    setVersion(body.data.version);
    setStatus(`Saved as version ${body.data.version}`);
    await loadTemplates(templateId);
  }

  async function render() {
    if (!templateId) return;
    setRendering(true);
    setRenderUrl('');
    setStatus('Queueing template render…');
    try {
      await save();
      const queued = await getJson(`/api/v1/templates/${encodeURIComponent(templateId)}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modifications: {}, response: { format: 'mp4', mode: 'async' } }),
      });
      const jobId = queued.data.jobId as string;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const body = await getJson(`/api/v1/render-jobs/${encodeURIComponent(jobId)}`);
        if (!body.data.finished) {
          setStatus(`Rendering · ${body.data.status}`);
          continue;
        }
        if (body.data.status !== 'succeeded') throw new Error(body.data.error || 'Render failed');
        setRenderUrl(body.data.result.url);
        setStatus('Render ready');
        return;
      }
      throw new Error('Render timed out');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Render failed');
    } finally {
      setRendering(false);
    }
  }

  function addText() {
    if (!page) return;
    const id = `text-${Date.now()}`;
    updateDocument((draft) => {
      draft.pages[pageIndex].elements.push({
        id,
        type: 'text',
        name: 'New text',
        content: 'New text layer',
        position: { x: 120, y: 520 },
        dimensions: { width: 720, height: 180 },
        zIndex: draft.pages[pageIndex].elements.length + 10,
        hidden: false,
        locked: false,
        parameterizable: false,
        style: {
          fontSize: 60, minFontSize: 18, fontFamily: 'Inter', fontWeight: 700,
          color: '#ffffff', textAlign: 'left', verticalAlign: 'flex-start', letterSpacing: 0,
          lineHeight: 1.1, textMode: 'fit', opacity: 1, borderRadius: 0,
          textStrokeWidth: 0, textStrokeColor: '#000000',
        },
      });
    });
    setSelectedId(id);
  }

  return (
    <main className="studioShell">
      <header className="studioTopbar">
        <a href="/" className="studioBrand">FACELESS <span>STUDIO</span></a>
        <div className="studioTemplateMeta">
          <select value={templateId} onChange={(event) => void loadTemplate(event.target.value)}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <span>v{version}</span>
        </div>
        <div className="studioActions">
          <span className="studioStatus">{status}</span>
          <button onClick={() => void save()} className="studioButton secondary">Save</button>
          <button onClick={() => void render()} className="studioButton" disabled={rendering}>{rendering ? 'Rendering…' : 'Render MP4'}</button>
        </div>
      </header>

      <div className="studioWorkspace">
        <aside className="layersPanel">
          <div className="panelTitle"><span>Layers</span><button onClick={addText}>+ Text</button></div>
          <div className="pageTabs">
            {document?.pages.map((item, index) => (
              <button className={pageIndex === index ? 'active' : ''} key={item.id} onClick={() => { setPageIndex(index); setSelectedId(item.elements[0]?.id || ''); }}>
                {index + 1}
              </button>
            ))}
          </div>
          <div className="layerList">
            {[...(page?.elements || [])].sort((a, b) => b.zIndex - a.zIndex).map((element) => (
              <button key={element.id} className={`layerRow ${selectedId === element.id ? 'selected' : ''}`} onClick={() => setSelectedId(element.id)}>
                <span className={`layerType type-${element.type}`}>{element.type.slice(0, 1).toUpperCase()}</span>
                <span><b>{elementLabel(element)}</b><small>{element.parameterizable ? `{${element.parameterId}}` : element.type}</small></span>
                <em>{element.locked ? '⌁' : ''}</em>
              </button>
            ))}
          </div>
          <div className="parametersPanel">
            <div className="panelTitle"><span>API parameters</span><small>{modifications.length}</small></div>
            {modifications.map(({ key, element }) => <div className="paramRow" key={key}><code>{key}</code><span>{element.type}</span></div>)}
          </div>
        </aside>

        <section className="canvasStage">
          <div className="canvasToolbar">
            <span>{page?.canvas.width || 0} × {page?.canvas.height || 0}</span>
            <span>{Math.round(scale * 100)}%</span>
          </div>
          {page && (
            <div className="canvasViewport" style={{ width: PREVIEW_WIDTH, height: previewHeight }}>
              <div
                className="designCanvas"
                style={{ width: page.canvas.width, height: page.canvas.height, background: page.canvas.backgroundColor, transform: `scale(${scale})` }}
              >
                {[...page.elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => {
                  const width = element.dimensions.width === 'auto' ? 400 : element.dimensions.width;
                  const height = element.dimensions.height === 'auto' ? 100 : element.dimensions.height;
                  const style: React.CSSProperties = {
                    position: 'absolute', left: element.position.x, top: element.position.y, width, height,
                    zIndex: element.zIndex, opacity: Number(element.style.opacity ?? 1), display: element.hidden ? 'none' : 'flex',
                    transform: `rotate(${Number((element as unknown as { rotation?: number }).rotation || 0)}deg)`,
                  };
                  let child: React.ReactNode;
                  if (element.type === 'text') {
                    child = <div className="previewText" style={{
                      color: String(element.style.color || '#fff'), fontSize: Number(element.style.fontSize || 48),
                      fontWeight: element.style.fontWeight as number | string, lineHeight: Number(element.style.lineHeight || 1.1),
                      letterSpacing: Number(element.style.letterSpacing || 0), textAlign: String(element.style.textAlign || 'left') as 'left' | 'center' | 'right',
                      background: String(element.style.backgroundColor || 'transparent'),
                    }}>{element.content}</div>;
                  } else if (element.type === 'shape' || element.type === 'container') {
                    child = <div className="previewShape" style={{ background: String(element.style.fill || element.style.backgroundColor || '#fff'), borderRadius: Number(element.style.borderRadius || 0), width: '100%', height: '100%' }} />;
                  } else {
                    child = <div className="mediaPlaceholder">{element.type}<small>{element.content || 'Choose asset'}</small></div>;
                  }
                  return (
                    <div
                      key={element.id}
                      data-element-id={element.id}
                      className={`canvasElement ${selectedId === element.id ? 'selected' : ''}`}
                      style={style}
                      onPointerDown={(event) => beginDrag(event, element)}
                      onPointerMove={drag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >{child}</div>
                  );
                })}
              </div>
            </div>
          )}
          {renderUrl && <div className="studioRenderPreview"><video src={renderUrl} controls playsInline /><a href={renderUrl} target="_blank" rel="noreferrer">Open rendered MP4 ↗</a></div>}
        </section>

        <aside className="inspectorPanel">
          <div className="panelTitle"><span>Inspector</span><small>{selected?.type || 'Nothing selected'}</small></div>
          {selected ? (
            <div className="inspectorForm">
              <label>Name<input value={selected.name || ''} onChange={(event) => updateSelected((item) => { item.name = event.target.value; })} /></label>
              {selected.type === 'text' && <label>Text<textarea rows={6} value={selected.content || ''} onChange={(event) => updateSelected((item) => { item.content = event.target.value; })} /></label>}
              <div className="twoCol">
                <label>X<input type="number" value={selected.position.x} onChange={(event) => updateSelected((item) => { item.position.x = numberValue(event.target.value, item.position.x); })} /></label>
                <label>Y<input type="number" value={selected.position.y} onChange={(event) => updateSelected((item) => { item.position.y = numberValue(event.target.value, item.position.y); })} /></label>
              </div>
              <div className="twoCol">
                <label>Width<input type="number" value={selected.dimensions.width === 'auto' ? 0 : selected.dimensions.width} onChange={(event) => updateSelected((item) => { item.dimensions.width = Math.max(1, numberValue(event.target.value, 1)); })} /></label>
                <label>Height<input type="number" value={selected.dimensions.height === 'auto' ? 0 : selected.dimensions.height} onChange={(event) => updateSelected((item) => { item.dimensions.height = Math.max(1, numberValue(event.target.value, 1)); })} /></label>
              </div>
              {selected.type === 'text' && <>
                <label>Font size<input type="number" value={Number(selected.style.fontSize || 48)} onChange={(event) => updateSelected((item) => { item.style.fontSize = numberValue(event.target.value, 48); })} /></label>
                <label>Text color<input type="color" value={String(selected.style.color || '#ffffff')} onChange={(event) => updateSelected((item) => { item.style.color = event.target.value; })} /></label>
              </>}
              {(selected.type === 'shape' || selected.type === 'container') && <label>Fill<input type="color" value={String(selected.style.fill || selected.style.backgroundColor || '#ffffff')} onChange={(event) => updateSelected((item) => { if (item.type === 'shape') item.style.fill = event.target.value; else item.style.backgroundColor = event.target.value; })} /></label>}
              <div className="switchRow">
                <span><b>API parameter</b><small>Expose this layer to automation</small></span>
                <input type="checkbox" checked={selected.parameterizable} onChange={(event) => updateSelected((item) => { item.parameterizable = event.target.checked; if (event.target.checked && !item.parameterId) item.parameterId = item.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase(); })} />
              </div>
              {selected.parameterizable && <label>Parameter ID<input value={selected.parameterId || ''} onChange={(event) => updateSelected((item) => { item.parameterId = event.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'); })} /></label>}
              <div className="switchRow"><span><b>Locked</b><small>Prevent canvas dragging</small></span><input type="checkbox" checked={selected.locked} onChange={(event) => updateSelected((item) => { item.locked = event.target.checked; })} /></div>
              <div className="switchRow"><span><b>Hidden</b><small>Exclude from preview/render</small></span><input type="checkbox" checked={selected.hidden} onChange={(event) => updateSelected((item) => { item.hidden = event.target.checked; })} /></div>
            </div>
          ) : <p className="emptyInspector">Select a layer on the canvas or in the layer list.</p>}
        </aside>
      </div>
    </main>
  );
}
