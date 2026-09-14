'use client';

import Link from 'next/link';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type ElementType = 'text' | 'image' | 'shape' | 'video' | 'waveform' | 'container';
type StudioElement = {
  id: string; type: ElementType; name?: string; content?: string; shapeType?: string;
  position: { x: number; y: number }; dimensions: { width: number | 'auto'; height: number | 'auto' };
  rotation?: number; zIndex: number; hidden: boolean; locked: boolean; parameterizable: boolean; parameterId?: string;
  style: Record<string, unknown>;
};
type StudioPage = {
  id: string; name: string;
  canvas: { width: number; height: number; backgroundColor: string; backgroundImage: string };
  elements: StudioElement[];
};
type StudioDocument = {
  schemaVersion: 1; name: string; description: string; tags: string[]; canvasWidth: number; canvasHeight: number;
  pages: StudioPage[]; variants: Array<{ id: string; name: string; width: number; height: number; mode: string }>;
};
type TemplateRecord = { id: string; name: string; version: number; document: StudioDocument };
type DragState = { id: string; startClientX: number; startClientY: number; startX: number; startY: number } | null;

const PREVIEW_WIDTH = 405;

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function numberValue(value: string, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function label(element: StudioElement) { return element.name || element.content?.slice(0, 25) || element.id; }

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`);
  return body;
}

function makeElement(type: ElementType, page: StudioPage): StudioElement {
  const id = `${type}-${Date.now()}`;
  const common = {
    id, type, name: `New ${type}`, position: { x: 120, y: 520 }, dimensions: { width: 720, height: 180 },
    rotation: 0, zIndex: page.elements.length + 20, hidden: false, locked: false, parameterizable: false,
  };
  if (type === 'text') return { ...common, content: 'New text layer', style: { fontSize: 60, minFontSize: 18, fontFamily: 'Inter', fontWeight: 700, color: '#ffffff', textAlign: 'left', verticalAlign: 'flex-start', letterSpacing: 0, lineHeight: 1.1, textMode: 'fit', opacity: 1, borderRadius: 0, textStrokeWidth: 0, textStrokeColor: '#000000' } };
  if (type === 'shape') return { ...common, shapeType: 'rectangle', dimensions: { width: 720, height: 260 }, style: { fill: '#D7FF64', stroke: 'transparent', strokeWidth: 0, borderRadius: 24, opacity: 1 } };
  if (type === 'container') return { ...common, dimensions: { width: 720, height: 260 }, style: { backgroundColor: '#171A1F', borderColor: '#30343B', borderWidth: 1, borderRadius: 24, opacity: 1 } };
  if (type === 'image') return { ...common, content: '', dimensions: { width: 720, height: 720 }, style: { objectFit: 'cover', objectPosition: 'center center', borderRadius: 24, borderWidth: 0, borderColor: '#000000', opacity: 1 } };
  if (type === 'video') return { ...common, content: '', dimensions: { width: 720, height: 720 }, style: { objectFit: 'cover', objectPosition: 'center center', borderRadius: 24, opacity: 1 } };
  return { ...common, dimensions: { width: 720, height: 160 }, style: { fill: '#D7FF64', opacity: 1 } };
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

  async function loadTemplate(id: string) {
    setStatus('Loading template…');
    const body = await jsonRequest(`/api/v1/templates/${encodeURIComponent(id)}`);
    const record = body.data as TemplateRecord;
    setTemplateId(record.id); setDocument(clone(record.document)); setVersion(record.version || 1); setPageIndex(0);
    setSelectedId(record.document.pages?.[0]?.elements?.[0]?.id || ''); setRenderUrl(''); setStatus(`Version ${record.version || 1} loaded`);
  }

  async function loadTemplates(preferredId?: string) {
    let body = await jsonRequest('/api/v1/templates');
    if (!body.data?.length) { await jsonRequest('/api/v1/templates/bootstrap', { method: 'POST' }); body = await jsonRequest('/api/v1/templates'); }
    const records = body.data as TemplateRecord[];
    setTemplates(records);
    const id = preferredId || records[0]?.id || '';
    if (id) await loadTemplate(id); else setStatus('No templates available');
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTemplates().catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load templates'));
    }, 0);
    return () => window.clearTimeout(timer);
    // Initial external data hydration only; selection changes are intentionally user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = document?.pages[pageIndex];
  const scale = page ? PREVIEW_WIDTH / page.canvas.width : 1;
  const previewHeight = page ? page.canvas.height * scale : 720;
  const selected = page?.elements.find((element) => element.id === selectedId) || null;
  const modifications = useMemo(() => {
    const rows: Array<{ key: string; element: StudioElement }> = [];
    document?.pages.forEach((docPage, index) => docPage.elements.forEach((element) => {
      if (element.parameterizable && element.parameterId) rows.push({ key: `${index === 0 ? '' : `page${index + 1}@`}${element.parameterId}`, element });
    }));
    return rows;
  }, [document]);

  function updateDocument(update: (draft: StudioDocument) => void) {
    setDocument((current) => { if (!current) return current; const next = clone(current); update(next); return next; });
  }
  function updateSelected(update: (element: StudioElement) => void) {
    updateDocument((draft) => { const element = draft.pages[pageIndex]?.elements.find((item) => item.id === selectedId); if (element) update(element); });
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, element: StudioElement) {
    if (element.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: element.id, startClientX: event.clientX, startClientY: event.clientY, startX: element.position.x, startY: element.position.y };
    setSelectedId(element.id);
  }
  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current || current.id !== event.currentTarget.dataset.elementId) return;
    const dx = (event.clientX - current.startClientX) / scale; const dy = (event.clientY - current.startClientY) / scale;
    updateDocument((draft) => { const element = draft.pages[pageIndex]?.elements.find((item) => item.id === current.id); if (element) element.position = { x: Math.round(current.startX + dx), y: Math.round(current.startY + dy) }; });
  }
  function endDrag() { dragRef.current = null; }

  function add(type: ElementType) {
    if (!page) return;
    const element = makeElement(type, page);
    updateDocument((draft) => draft.pages[pageIndex].elements.push(element));
    setSelectedId(element.id);
  }

  async function save(reload = true) {
    if (!document || !templateId) return;
    setStatus('Saving version…');
    const body = await jsonRequest(`/api/v1/templates/${encodeURIComponent(templateId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: document }) });
    setVersion(body.data.version); setStatus(`Saved as version ${body.data.version}`);
    if (reload) await loadTemplates(templateId);
  }

  async function render() {
    if (!templateId) return;
    setRendering(true); setRenderUrl('');
    try {
      await save(false); setStatus('Queueing template render…');
      const queued = await jsonRequest('/api/v1/studio/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId, modifications: {}, response: { format: 'mp4', mode: 'async' } }) });
      const jobId = queued.data.jobId as string;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const body = await jsonRequest(`/api/v1/render-jobs/${encodeURIComponent(jobId)}`);
        if (!body.data.finished) { setStatus(`Rendering · ${body.data.status}`); continue; }
        if (body.data.status !== 'succeeded') throw new Error(body.data.error || 'Render failed');
        setRenderUrl(body.data.result.url); setStatus('Render ready'); return;
      }
      throw new Error('Render timed out');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Render failed'); }
    finally { setRendering(false); }
  }

  function preview(element: StudioElement): ReactNode {
    if (element.type === 'text') return <div className="previewText" style={{ color: String(element.style.color || '#fff'), fontSize: Number(element.style.fontSize || 48), fontWeight: element.style.fontWeight as number | string, lineHeight: Number(element.style.lineHeight || 1.1), letterSpacing: Number(element.style.letterSpacing || 0), textAlign: String(element.style.textAlign || 'left') as 'left'|'center'|'right', background: String(element.style.backgroundColor || 'transparent') }}>{element.content}</div>;
    if (element.type === 'shape' || element.type === 'container') return <div className="previewShape" style={{ background: String(element.style.fill || element.style.backgroundColor || '#fff'), borderRadius: Number(element.style.borderRadius || 0), width: '100%', height: '100%' }} />;
    if (element.type === 'image' && element.content) return <img src={element.content} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: String(element.style.objectFit || 'cover') as 'cover'|'contain'|'fill', borderRadius: Number(element.style.borderRadius || 0) }} />;
    if (element.type === 'video' && element.content) return <video src={element.content} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: String(element.style.objectFit || 'cover') as 'cover'|'contain'|'fill', borderRadius: Number(element.style.borderRadius || 0) }} />;
    return <div className="mediaPlaceholder">{element.type}<small>{element.content || 'Choose asset'}</small></div>;
  }

  return <main className="studioShell">
    <header className="studioTopbar">
      <Link href="/" className="studioBrand">FACELESS <span>STUDIO</span></Link>
      <div className="studioTemplateMeta"><select value={templateId} onChange={(event) => void loadTemplate(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select><span>v{version}</span></div>
      <div className="studioActions"><span className="studioStatus">{status}</span><button onClick={() => void save()} className="studioButton secondary">Save</button><button onClick={() => void render()} className="studioButton" disabled={rendering}>{rendering ? 'Rendering…' : 'Render MP4'}</button></div>
    </header>

    <div className="studioWorkspace">
      <aside className="layersPanel">
        <div className="panelTitle"><span>Layers</span><div className="layerAdd"><button onClick={() => add('text')}>T</button><button onClick={() => add('image')}>I</button><button onClick={() => add('video')}>V</button><button onClick={() => add('shape')}>▭</button></div></div>
        <div className="pageTabs">{document?.pages.map((item,index)=><button className={pageIndex===index?'active':''} key={item.id} onClick={()=>{setPageIndex(index);setSelectedId(item.elements[0]?.id||'')}}>{index+1}</button>)}</div>
        <div className="layerList">{[...(page?.elements||[])].sort((a,b)=>b.zIndex-a.zIndex).map((element)=><button key={element.id} className={`layerRow ${selectedId===element.id?'selected':''}`} onClick={()=>setSelectedId(element.id)}><span className={`layerType type-${element.type}`}>{element.type[0].toUpperCase()}</span><span><b>{label(element)}</b><small>{element.parameterizable?`{${element.parameterId}}`:element.type}</small></span><em>{element.locked?'⌁':''}</em></button>)}</div>
        <div className="parametersPanel"><div className="panelTitle"><span>API parameters</span><small>{modifications.length}</small></div>{modifications.map(({key,element})=><div className="paramRow" key={key}><code>{key}</code><span>{element.type}</span></div>)}</div>
      </aside>

      <section className="canvasStage">
        <div className="canvasToolbar"><span>{page?.canvas.width||0} × {page?.canvas.height||0}</span><span>{Math.round(scale*100)}%</span></div>
        {page&&<div className="canvasViewport" style={{width:PREVIEW_WIDTH,height:previewHeight}}><div className="designCanvas" style={{width:page.canvas.width,height:page.canvas.height,background:page.canvas.backgroundColor,transform:`scale(${scale})`}}>{[...page.elements].sort((a,b)=>a.zIndex-b.zIndex).map((element)=>{
          const width=element.dimensions.width==='auto'?400:element.dimensions.width; const height=element.dimensions.height==='auto'?100:element.dimensions.height;
          const style:CSSProperties={position:'absolute',left:element.position.x,top:element.position.y,width,height,zIndex:element.zIndex,opacity:Number(element.style.opacity??1),display:element.hidden?'none':'flex',transform:`rotate(${Number(element.rotation||0)}deg)`};
          return <div key={element.id} data-element-id={element.id} className={`canvasElement ${selectedId===element.id?'selected':''}`} style={style} onPointerDown={(event)=>beginDrag(event,element)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>{preview(element)}</div>;
        })}</div></div>}
        {renderUrl&&<div className="studioRenderPreview"><video src={renderUrl} controls playsInline/><a href={renderUrl} target="_blank" rel="noreferrer">Open rendered MP4 ↗</a></div>}
      </section>

      <aside className="inspectorPanel">
        <div className="panelTitle"><span>Inspector</span><small>{selected?.type||'Nothing selected'}</small></div>
        {selected?<div className="inspectorForm">
          <label>Name<input value={selected.name||''} onChange={(e)=>updateSelected((item)=>{item.name=e.target.value})}/></label>
          {selected.type==='text'&&<label>Text<textarea rows={5} value={selected.content||''} onChange={(e)=>updateSelected((item)=>{item.content=e.target.value})}/></label>}
          {(selected.type==='image'||selected.type==='video')&&<label>Media URL<input value={selected.content||''} placeholder="https://…" onChange={(e)=>updateSelected((item)=>{item.content=e.target.value})}/></label>}
          <div className="twoCol"><label>X<input type="number" value={selected.position.x} onChange={(e)=>updateSelected((item)=>{item.position.x=numberValue(e.target.value,item.position.x)})}/></label><label>Y<input type="number" value={selected.position.y} onChange={(e)=>updateSelected((item)=>{item.position.y=numberValue(e.target.value,item.position.y)})}/></label></div>
          <div className="twoCol"><label>Width<input type="number" value={selected.dimensions.width==='auto'?0:selected.dimensions.width} onChange={(e)=>updateSelected((item)=>{item.dimensions.width=Math.max(1,numberValue(e.target.value,1))})}/></label><label>Height<input type="number" value={selected.dimensions.height==='auto'?0:selected.dimensions.height} onChange={(e)=>updateSelected((item)=>{item.dimensions.height=Math.max(1,numberValue(e.target.value,1))})}/></label></div>
          {selected.type==='text'&&<><label>Font size<input type="number" value={Number(selected.style.fontSize||48)} onChange={(e)=>updateSelected((item)=>{item.style.fontSize=numberValue(e.target.value,48)})}/></label><label>Text color<input type="color" value={String(selected.style.color||'#ffffff')} onChange={(e)=>updateSelected((item)=>{item.style.color=e.target.value})}/></label></>}
          {(selected.type==='shape'||selected.type==='container')&&<label>Fill<input type="color" value={String(selected.style.fill||selected.style.backgroundColor||'#ffffff')} onChange={(e)=>updateSelected((item)=>{if(item.type==='shape')item.style.fill=e.target.value;else item.style.backgroundColor=e.target.value})}/></label>}
          {(selected.type==='image'||selected.type==='video')&&<label>Fit<select value={String(selected.style.objectFit||'cover')} onChange={(e)=>updateSelected((item)=>{item.style.objectFit=e.target.value})}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label>}
          <div className="switchRow"><span><b>API parameter</b><small>Expose layer to automation</small></span><input type="checkbox" checked={selected.parameterizable} onChange={(e)=>updateSelected((item)=>{item.parameterizable=e.target.checked;if(e.target.checked&&!item.parameterId)item.parameterId=item.id.replace(/[^a-z0-9_]/gi,'_').toLowerCase()})}/></div>
          {selected.parameterizable&&<label>Parameter ID<input value={selected.parameterId||''} onChange={(e)=>updateSelected((item)=>{item.parameterId=e.target.value.replace(/[^a-zA-Z0-9_-]/g,'_')})}/></label>}
          <div className="switchRow"><span><b>Locked</b><small>Prevent canvas dragging</small></span><input type="checkbox" checked={selected.locked} onChange={(e)=>updateSelected((item)=>{item.locked=e.target.checked})}/></div>
          <div className="switchRow"><span><b>Hidden</b><small>Exclude from preview/render</small></span><input type="checkbox" checked={selected.hidden} onChange={(e)=>updateSelected((item)=>{item.hidden=e.target.checked})}/></div>
        </div>:<p className="emptyInspector">Select a layer on the canvas or in the layer list.</p>}
      </aside>
    </div>
  </main>;
}
