'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Film,
  Image as ImageIcon,
  Library,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Radio,
  Send,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

type VisualBeat = {
  id: string;
  sentence: string;
  query: string;
  provider: 'wikimedia' | 'search';
  imageUrl?: string;
  sourceUrl: string;
  attribution?: string;
};

type Channel = { id: string; name: string; niche: string; handle?: string | null; voice?: string | null; templateId?: string | null };
type Publication = { id: string; platform: string; status: string; scheduledFor?: string | null; publishedAt?: string | null };
type ContentItem = {
  id: string;
  channelId: string;
  topic: string;
  hook?: string | null;
  script?: string | null;
  caption?: string | null;
  status: string;
  videoUrl?: string | null;
  visuals?: unknown;
  scheduledFor?: string | null;
  createdAt: string;
  channel?: Channel;
  publications?: Publication[];
};
type Series = {
  id: string;
  name: string;
  brief: string;
  audience?: string | null;
  cadence: 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
  weekday?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  status: 'ACTIVE' | 'PAUSED';
  approvalRequired: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  channel: Channel;
};
type SocialAccount = {
  id: string;
  platform: string;
  account_name: string;
  account_username?: string;
  status: string;
  requires_reconnect: boolean;
};

type ScriptDraft = { topic: string; hook: string; script: string; caption: string; statNumber?: string; statLabel?: string };

const voices = [
  ['en-us', 'US English'], ['en-gb', 'British English'], ['en-sc', 'Scottish English'], ['en-westindies', 'Caribbean English'],
];
const templates = [['editorial', 'Editorial'], ['signal', 'Signal'], ['ember', 'Ember']] as const;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const tabs = [
  { id: 'create', label: 'Create', icon: WandSparkles },
  { id: 'series', label: 'Series', icon: CalendarClock },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'publish', label: 'Publish', icon: Radio },
] as const;
type Tab = (typeof tabs)[number]['id'];

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function visualBeats(content: ContentItem | null) { return Array.isArray(content?.visuals) ? content.visuals as VisualBeat[] : []; }

async function api<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(pathname, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `${init?.method ?? 'GET'} ${pathname} failed`);
  return body as T;
}

export function Creator() {
  const [tab, setTab] = useState<Tab>('create');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [niche, setNiche] = useState('Artificial intelligence');
  const [idea, setIdea] = useState('Why AI agents need memory');
  const [audience, setAudience] = useState('builders and curious professionals');
  const [voice, setVoice] = useState('en-us');
  const [speechRate, setSpeechRate] = useState(165);
  const [template, setTemplate] = useState<(typeof templates)[number][0]>('editorial');
  const [draft, setDraft] = useState<ScriptDraft | null>(null);
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleFor, setScheduleFor] = useState('');
  const [seriesName, setSeriesName] = useState('AI systems explained');
  const [seriesBrief, setSeriesBrief] = useState('Explain one practical AI systems concept with a surprising hook and one concrete example.');
  const [seriesCadence, setSeriesCadence] = useState<'DAILY' | 'WEEKDAYS' | 'WEEKLY'>('WEEKDAYS');
  const [seriesTime, setSeriesTime] = useState('09:00');
  const [seriesWeekday, setSeriesWeekday] = useState(new Date().getDay());
  const [connectPlatform, setConnectPlatform] = useState('youtube');
  const [connectLabel, setConnectLabel] = useState('My channel');
  const [connectUsername, setConnectUsername] = useState('');
  const [connectToken, setConnectToken] = useState('');

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const connectedAccounts = useMemo(() => accounts.filter((account) => account.status === 'connected' && !account.requires_reconnect), [accounts]);
  const visuals = visualBeats(activeContent);

  const loadData = useCallback(async () => {
    try {
      const channelResponse = await api<{ channels: Channel[] }>('/api/channels', { cache: 'no-store' });
      let available = channelResponse.channels;
      if (!available.length) {
        const created = await api<{ channel: Channel }>('/api/channels', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Main channel', niche: 'Artificial intelligence', handle: '@faceless', voice: 'en-us', templateId: 'editorial' }),
        });
        available = [created.channel];
      }
      setChannels(available);
      setSelectedChannelId((current) => current || available[0]?.id || '');
      const [contentResponse, seriesResponse, accountResponse] = await Promise.all([
        api<{ contents: ContentItem[] }>('/api/content', { cache: 'no-store' }),
        api<{ series: Series[] }>('/api/series', { cache: 'no-store' }),
        api<{ accounts: SocialAccount[] }>('/api/social/accounts', { cache: 'no-store' }),
      ]);
      setContents(contentResponse.contents);
      setSeries(seriesResponse.series);
      setAccounts(accountResponse.accounts);
      setActiveContent((current) => current ? contentResponse.contents.find((item) => item.id === current.id) ?? current : contentResponse.contents[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load studio');
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!selectedChannelId) return;
    setBusy(true); setError(''); setNotice(''); setStage('Writing the short');
    try {
      const scriptResponse = await api<{ result: ScriptDraft }>('/api/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ niche, idea, audience }),
      });
      setDraft(scriptResponse.result);
      setStage('Matching visuals to each sentence');
      const visualResponse = await api<{ visuals: VisualBeat[] }>('/api/visuals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: scriptResponse.result.script }),
      }).catch(() => ({ visuals: [] }));
      setStage('Saving the project');
      const created = await api<{ content: ContentItem }>('/api/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: selectedChannelId, ...scriptResponse.result, visuals: visualResponse.visuals }),
      });
      setActiveContent({ ...created.content, visuals: visualResponse.visuals });
      setContents((items) => [{ ...created.content, visuals: visualResponse.visuals }, ...items.filter((item) => item.id !== created.content.id)]);
      setNotice('Draft created. Review the script and visual research, then render the vertical video.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the short');
    } finally { setBusy(false); setStage(''); }
  }

  async function renderActive() {
    if (!activeContent) return;
    setBusy(true); setError(''); setNotice(''); setStage('Queueing narration + vertical render');
    try {
      await api(`/api/content/${encodeURIComponent(activeContent.id)}/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice, speechRate, template }),
      });
      for (let attempt = 0; attempt < 160; attempt += 1) {
        setStage(attempt < 2 ? 'Starting the render worker' : 'Rendering voice, captions and 9:16 video');
        await sleep(1500);
        const response = await api<{ content: ContentItem }>(`/api/content/${encodeURIComponent(activeContent.id)}`, { cache: 'no-store' });
        setActiveContent(response.content);
        if (response.content.status === 'FAILED') throw new Error('The render worker reported a failure.');
        if (response.content.status === 'REVIEW' && response.content.videoUrl) {
          setContents((items) => items.map((item) => item.id === response.content.id ? response.content : item));
          setNotice('Render complete. Watch it, then explicitly approve it before publishing.');
          return;
        }
      }
      throw new Error('Render is still running. It remains durable and can be reopened from the library.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to render'); }
    finally { setBusy(false); setStage(''); }
  }

  async function approveActive() {
    if (!activeContent) return;
    setBusy(true); setError('');
    try {
      const response = await api<{ content: ContentItem }>(`/api/content/${encodeURIComponent(activeContent.id)}/approve`, { method: 'POST' });
      setActiveContent(response.content);
      setContents((items) => items.map((item) => item.id === response.content.id ? response.content : item));
      setNotice('Approved. Publishing and scheduling are now unlocked.');
      setTab('publish');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to approve'); }
    finally { setBusy(false); }
  }

  async function publishActive() {
    if (!activeContent || !selectedAccounts.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const payload: { accountIds: string[]; scheduledFor?: string } = { accountIds: selectedAccounts };
      if (scheduleFor) payload.scheduledFor = new Date(scheduleFor).toISOString();
      await api(`/api/content/${encodeURIComponent(activeContent.id)}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      setNotice(scheduleFor ? 'Publication scheduled.' : 'Publication queued.');
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to publish'); }
    finally { setBusy(false); }
  }

  async function createSeries(event: FormEvent) {
    event.preventDefault();
    if (!selectedChannelId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const [hour, minute] = seriesTime.split(':').map(Number);
      const response = await api<{ series: Series }>('/api/series', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId, name: seriesName, brief: seriesBrief, audience,
          cadence: seriesCadence, weekday: seriesCadence === 'WEEKLY' ? seriesWeekday : null,
          hour, minute, timezone, approvalRequired: true,
        }),
      });
      setSeries((items) => [response.series, ...items]);
      setNotice('Series created. Every generated episode still requires explicit approval before publishing.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create series'); }
    finally { setBusy(false); }
  }

  async function runSeries(item: Series) {
    setBusy(true); setError(''); setNotice(''); setStage(`Generating ${item.name}`);
    try {
      const response = await api<{ content: ContentItem }>(`/api/series/${encodeURIComponent(item.id)}/run`, { method: 'POST' });
      setActiveContent(response.content);
      setDraft({
        topic: response.content.topic,
        hook: response.content.hook ?? '',
        script: response.content.script ?? '',
        caption: response.content.caption ?? '',
      });
      setTab('create');
      await loadData();
      setNotice('Fresh series episode created with visual research. Render it when ready.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to generate series episode'); }
    finally { setBusy(false); setStage(''); }
  }

  async function toggleSeries(item: Series) {
    try {
      await api(`/api/series/${encodeURIComponent(item.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }),
      });
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update series'); }
  }

  async function connectAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/social/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: connectPlatform, label: connectLabel, username: connectUsername || undefined, accessToken: connectToken || undefined }),
      });
      setConnectToken('');
      setNotice('Publishing account saved.');
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect publishing account'); }
    finally { setBusy(false); }
  }

  function openContent(item: ContentItem) {
    setActiveContent(item);
    setDraft(item.script ? { topic: item.topic, hook: item.hook ?? '', script: item.script, caption: item.caption ?? '' } : null);
    setTab(item.status === 'APPROVED' || item.status === 'SCHEDULED' || item.status === 'PUBLISHED' ? 'publish' : 'create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const steps = [
    { label: 'Script', done: Boolean(activeContent?.script) },
    { label: 'Visuals', done: visuals.length > 0 },
    { label: 'Render', done: Boolean(activeContent?.videoUrl) },
    { label: 'Approve', done: ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(activeContent?.status ?? '') },
    { label: 'Publish', done: activeContent?.status === 'PUBLISHED' || (activeContent?.publications?.length ?? 0) > 0 },
  ];

  return (
    <div className="productShell">
      <aside className="studioSidebar">
        <div className="studioBrand"><div className="brandMark"><Film size={18}/></div><div><b>Faceless Studio</b><span>owned video engine</span></div></div>
        <nav className="studioNav">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17}/>{item.label}</button>; })}</nav>
        <div className="sidebarFoot"><span className="liveDot"/>Local render engine<div>{contents.length} projects · {series.length} series</div></div>
      </aside>

      <main className="studioMain">
        <header className="studioHeader">
          <div><div className="eyebrow">Reverse-engineered creator workflow</div><h1>{tab === 'create' ? 'Create a short' : tab === 'series' ? 'Recurring series' : tab === 'library' ? 'Content library' : 'Review & publish'}</h1></div>
          <div className="headerActions"><a className="iconButton" href="/studio">Template Studio</a><div className="engineBadge"><span className="liveDot"/>FFmpeg ready</div></div>
        </header>

        {stage && <div className="activityBar"><LoaderCircle size={16} className="spin"/>{stage}</div>}
        {error && <div className="errorBox">{error}</div>}
        {notice && <div className="successBox">{notice}</div>}

        {tab === 'create' && <>
          <section className="workflowStrip">{steps.map((step, index) => <div className={`workflowStep ${step.done ? 'done' : ''}`} key={step.label}><span>{step.done ? <CheckCircle2 size={16}/> : index + 1}</span><b>{step.label}</b></div>)}</section>

          <div className="creatorWorkspace">
            <section className="workspaceCard inputCard">
              <div className="cardTitle"><div><span className="sectionKicker">01 · Brief</span><h2>What should this short say?</h2></div><Sparkles size={22}/></div>
              <form className="stackForm" onSubmit={generate}>
                <label>Channel<select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
                <div className="formPair"><label>Niche<input value={niche} onChange={(e) => setNiche(e.target.value)}/></label><label>Audience<input value={audience} onChange={(e) => setAudience(e.target.value)}/></label></div>
                <label>Idea<textarea rows={4} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Explain one clear idea..."/></label>
                <div className="formPair"><label>Visual style<select value={template} onChange={(e) => setTemplate(e.target.value as (typeof templates)[number][0])}>{templates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Voice<select value={voice} onChange={(e) => setVoice(e.target.value)}>{voices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
                <label>Speech speed<div className="rangeLine"><input type="range" min="110" max="230" value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))}/><span>{speechRate} wpm</span></div></label>
                <button className="primaryButton" disabled={busy || !selectedChannelId}><WandSparkles size={17}/>{busy ? 'Working…' : 'Generate script + visuals'}</button>
              </form>
            </section>

            <section className="workspaceCard previewCard">
              <div className="cardTitle"><div><span className="sectionKicker">02 · Preview</span><h2>{activeContent ? activeContent.topic : 'Your project will appear here'}</h2></div>{activeContent && <span className={`statusPill status-${activeContent.status.toLowerCase()}`}>{activeContent.status}</span>}</div>
              {!activeContent && <div className="emptyPreview"><div className="phoneGhost"><Sparkles size={30}/><span>9:16</span></div><p>Generate a draft to create a persistent project, research visuals, synthesize narration and render an MP4.</p></div>}
              {activeContent && <div className="projectPreview">
                {activeContent.videoUrl ? <video className="shortPreview" src={activeContent.videoUrl} controls playsInline/> : <div className={`shortMock template-${template}`}><span className="mockTopic">{activeContent.topic}</span><strong>{activeContent.hook}</strong><small>Captions + narration render here</small></div>}
                <div className="previewCopy"><span className="sectionKicker">Hook</span><h3>{activeContent.hook}</h3><p>{activeContent.script}</p><div className="captionBox">{activeContent.caption}</div>
                  <div className="actionRow">
                    {!activeContent.videoUrl && <button className="primaryButton" onClick={renderActive} disabled={busy}><Play size={16}/>Render 9:16 video</button>}
                    {activeContent.status === 'REVIEW' && <button className="approveButton" onClick={approveActive} disabled={busy}><CheckCircle2 size={16}/>Approve video</button>}
                    {activeContent.videoUrl && <a className="secondaryButton" href={activeContent.videoUrl} download><Download size={16}/>Download MP4</a>}
                  </div>
                </div>
              </div>}
            </section>
          </div>

          {activeContent && <section className="workspaceCard visualsCard"><div className="cardTitle"><div><span className="sectionKicker">03 · Visual research</span><h2>Sentence-level source matching</h2><p>Wikimedia candidates retain their source links. Missing matches stay as explicit searches rather than invented assets.</p></div><ImageIcon size={22}/></div>
            <div className="visualGrid">{visuals.length ? visuals.map((beat, index) => <article className="visualBeat" key={beat.id}>{beat.imageUrl ? <img src={beat.imageUrl} alt=""/> : <div className="visualPlaceholder"><ImageIcon size={24}/></div>}<div><span>Beat {index + 1} · {beat.provider}</span><p>{beat.sentence}</p><b>{beat.query}</b><a href={beat.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>{beat.attribution && <small>{beat.attribution}</small>}</div></article>) : <div className="emptyInline">No external visual candidate was required or available. The renderer will use the selected owned template.</div>}</div>
          </section>}
        </>}

        {tab === 'series' && <div className="twoColumn">
          <section className="workspaceCard"><div className="cardTitle"><div><span className="sectionKicker">Recurring content</span><h2>Create a series</h2><p>Cadence is stored in your local timezone. Every episode defaults to approval-required.</p></div><CalendarClock size={22}/></div>
            <form className="stackForm" onSubmit={createSeries}><label>Series name<input value={seriesName} onChange={(e) => setSeriesName(e.target.value)}/></label><label>Creative brief<textarea rows={5} value={seriesBrief} onChange={(e) => setSeriesBrief(e.target.value)}/></label><label>Channel<select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label><div className="formPair"><label>Cadence<select value={seriesCadence} onChange={(e) => setSeriesCadence(e.target.value as typeof seriesCadence)}><option value="DAILY">Every day</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Weekly</option></select></label><label>Time<input type="time" value={seriesTime} onChange={(e) => setSeriesTime(e.target.value)}/></label></div>{seriesCadence === 'WEEKLY' && <label>Day<select value={seriesWeekday} onChange={(e) => setSeriesWeekday(Number(e.target.value))}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}<div className="timezoneNote"><Clock3 size={15}/>{timezone}</div><button className="primaryButton" disabled={busy}><Plus size={16}/>Create recurring series</button></form>
          </section>
          <section className="workspaceCard"><div className="cardTitle"><div><span className="sectionKicker">Series queue</span><h2>{series.length} active definitions</h2></div></div><div className="seriesList">{series.length ? series.map((item) => <article className="seriesItem" key={item.id}><div className="seriesTop"><div><h3>{item.name}</h3><span>{item.channel.name} · {item.cadence.toLowerCase()}</span></div><span className={`statusPill ${item.status === 'ACTIVE' ? 'status-approved' : ''}`}>{item.status}</span></div><p>{item.brief}</p><div className="seriesMeta"><span><Clock3 size={14}/>{item.nextRunAt ? new Date(item.nextRunAt).toLocaleString() : 'Paused'}</span><span>Approval required</span></div><div className="actionRow"><button className="secondaryButton" onClick={() => runSeries(item)} disabled={busy}><Sparkles size={15}/>Generate next episode</button><button className="ghostButton" onClick={() => toggleSeries(item)}>{item.status === 'ACTIVE' ? <><Pause size={15}/>Pause</> : <><Play size={15}/>Resume</>}</button></div></article>) : <div className="emptyInline">No recurring series yet.</div>}</div></section>
        </div>}

        {tab === 'library' && <section className="workspaceCard"><div className="cardTitle"><div><span className="sectionKicker">Persistent projects</span><h2>Content library</h2><p>Every draft, render, approval and publication stays addressable.</p></div><Library size={22}/></div><div className="libraryList">{contents.map((item) => <button className="libraryItem" key={item.id} onClick={() => openContent(item)}><div className="libraryThumb">{item.videoUrl ? <video src={item.videoUrl} muted/> : <Film size={20}/>}</div><div className="libraryCopy"><b>{item.hook || item.topic}</b><span>{item.channel?.name ?? 'Channel'} · {new Date(item.createdAt).toLocaleDateString()}</span></div><span className={`statusPill status-${item.status.toLowerCase()}`}>{item.status}</span></button>)}</div></section>}

        {tab === 'publish' && <div className="twoColumn">
          <section className="workspaceCard"><div className="cardTitle"><div><span className="sectionKicker">Approval gate</span><h2>{activeContent?.hook ?? 'Choose a project'}</h2></div>{activeContent && <span className={`statusPill status-${activeContent.status.toLowerCase()}`}>{activeContent.status}</span>}</div>{!activeContent ? <div className="emptyInline">Open a project from the library first.</div> : <><div className="publishPreview">{activeContent.videoUrl ? <video src={activeContent.videoUrl} controls playsInline/> : <div className="visualPlaceholder"><Film size={28}/></div>}<div><p>{activeContent.caption}</p>{activeContent.status === 'REVIEW' && <button className="approveButton" onClick={approveActive}><CheckCircle2 size={16}/>Approve before publishing</button>}{activeContent.videoUrl && <a className="secondaryButton" href={activeContent.videoUrl} download><Download size={16}/>Download</a>}</div></div>{['APPROVED','SCHEDULED','PUBLISHED'].includes(activeContent.status) && <div className="publishControls"><h3>Destinations</h3>{connectedAccounts.length ? <div className="accountList">{connectedAccounts.map((account) => <label key={account.id}><input type="checkbox" checked={selectedAccounts.includes(account.id)} onChange={(e) => setSelectedAccounts((ids) => e.target.checked ? [...ids, account.id] : ids.filter((id) => id !== account.id))}/><div><b>{account.account_name}</b><span>{account.platform}{account.account_username ? ` · ${account.account_username}` : ''}</span></div></label>)}</div> : <div className="emptyInline">No connected publishing accounts. Add one on the right, or download the MP4 and post manually.</div>}<label className="scheduleLabel">Schedule (optional)<input type="datetime-local" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)}/></label><button className="primaryButton" onClick={publishActive} disabled={busy || !selectedAccounts.length}><Send size={16}/>{scheduleFor ? 'Schedule publication' : 'Publish now'}</button></div>}</>}</section>
          <section className="workspaceCard"><div className="cardTitle"><div><span className="sectionKicker">Publishing connection</span><h2>Add an account</h2><p>Tokens are encrypted at rest when SOCIAL_TOKEN_KEY or APP_SECRET is configured. OAuth remains the production follow-on.</p></div><Radio size={22}/></div><form className="stackForm" onSubmit={connectAccount}><label>Platform<select value={connectPlatform} onChange={(e) => setConnectPlatform(e.target.value)}><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></label><label>Label<input value={connectLabel} onChange={(e) => setConnectLabel(e.target.value)}/></label><label>Username<input value={connectUsername} onChange={(e) => setConnectUsername(e.target.value)} placeholder="optional"/></label><label>Platform access token<input type="password" value={connectToken} onChange={(e) => setConnectToken(e.target.value)} placeholder="stored encrypted when configured"/></label><button className="secondaryButton" disabled={busy}>Save publishing account</button></form><div className="connectedList">{accounts.map((account) => <div key={account.id}><span className={account.status === 'connected' ? 'liveDot' : 'offlineDot'}/><div><b>{account.account_name}</b><span>{account.platform} · {account.status}</span></div></div>)}</div></section>
        </div>}
      </main>
    </div>
  );
}
