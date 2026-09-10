"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PipelineResult, RenderJobStatus } from "@/lib/types";

type Props = { userEmail: string };
type Analytics = { views: number; likes: number; shares: number; saves: number; engagement_rate: number };
const initialMetrics: Analytics = { views: 184200, likes: 12840, shares: 2240, saves: 3180, engagement_rate: 9.8 };

export default function StudioDashboard({ userEmail }: Props) {
  const [niche, setNiche] = useState("AI and technology");
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [job, setJob] = useState<RenderJobStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Analytics>(initialMetrics);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.ok ? r.json() : null).then((payload) => {
      const m = payload?.analytics?.data?.metrics;
      if (m) setMetrics({ views: Number(m.views ?? 0), likes: Number(m.likes ?? 0), shares: Number(m.shares ?? 0), saves: Number(m.saves ?? 0), engagement_rate: Number(m.engagement_rate ?? 0) });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pipeline?.renderJobId || pipeline.mode === "demo") return;
    let cancelled = false;
    const tick = async () => {
      const response = await fetch(`/api/renders/${pipeline.renderJobId}`);
      if (!response.ok || cancelled) return;
      const value = await response.json() as RenderJobStatus;
      setJob(value);
      if (!value.finished && !cancelled) window.setTimeout(tick, 5000);
    };
    tick(); return () => { cancelled = true; };
  }, [pipeline]);

  async function create(autoPublish = false) {
    setBusy(true); setError(""); setJob(null);
    try {
      const response = await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche, mode: "presenter", autoPublish }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Pipeline failed");
      setPipeline(data);
      if (data.mode === "demo") setJob({ id: data.renderJobId, status: "demo", finished: true, mediaUrl: data.previewUrl });
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!pipeline || !job?.mediaUrl) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaUrl: job.mediaUrl, content: `${pipeline.idea.caption}\n\n${pipeline.idea.hashtags.join(" ")}` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Publish failed");
      setPipeline({ ...pipeline, publishRequested: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Publish failed"); }
    finally { setBusy(false); }
  }

  const state = useMemo(() => pipeline ? (pipeline.publishRequested ? "Published" : job?.finished ? "Ready for review" : "Rendering") : "Idle", [pipeline, job]);
  const fmt = (value: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

  return <main className="studio">
    <aside className="sidebar"><Link href="/" className="brand"><span className="brandMark">F</span> FACELESS</Link><nav><a className="selected">◫ <span>Command center</span></a><a>⌁ <span>Ideas</span></a><a>▶ <span>Videos</span></a><a>□ <span>Calendar</span></a><a>⌗ <span>Analytics</span></a><a>◎ <span>Channels</span></a></nav><div className="sidebarBottom"><div className="systemDot"><i /> SYSTEM ONLINE</div><span>{userEmail}</span><form action="/api/auth/logout" method="post"><button>Sign out</button></form></div></aside>
    <section className="workspace">
      <header className="studioHeader"><div><span className="mutedLabel">CONTENT OPS</span><h1>Command center</h1></div><div className="headerActions"><span className="modeChip">DEMO-SAFE</span><button className="button small" onClick={() => create(false)} disabled={busy}>+ New content run</button></div></header>
      <div className="metricGrid"><Metric label="TOTAL VIEWS / 30D" value={fmt(metrics.views)} delta="+18.4%" /><Metric label="ENGAGEMENT RATE" value={`${metrics.engagement_rate}%`} delta="+2.1%" /><Metric label="SAVES" value={fmt(metrics.saves)} delta="+24.7%" /><Metric label="SHARES" value={fmt(metrics.shares)} delta="+11.2%" /></div>
      <div className="studioGrid">
        <section className="panel creationPanel"><div className="panelHead"><div><span className="mutedLabel">CREATE</span><h2>Build the next short</h2></div><span className={`statusTag ${state === "Published" ? "success" : ""}`}>{state}</span></div><label className="fieldLabel">CHANNEL NICHE</label><div className="promptRow"><input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. AI tools for builders" /><button onClick={() => create(false)} disabled={busy}>{busy ? "Working…" : "Generate →"}</button></div>{error && <div className="errorBox">{error}</div>}<div className="ideaCard"><div className="ideaTop"><span>{pipeline?.idea.topic ?? "YOUR NEXT IDEA"}</span><strong>{pipeline?.idea.score ?? "—"}<small>/100</small></strong></div><h3>{pipeline?.idea.hook ?? "Start a content run and the strongest concept will land here."}</h3><p>{pipeline?.idea.script ?? "The pipeline will generate the angle, script, caption, render job and review state in one run."}</p><div className="ideaMeta"><span>{pipeline ? `${pipeline.idea.script.split(/\s+/).length} words` : "70–115 words"}</span><span>9:16 vertical</span><span>Caption-ready</span></div></div><div className="pipelineTrack">{["IDEA","SCRIPT","PRESENTER","RENDER","REVIEW","PUBLISH"].map((s,i) => <div key={s} className={pipeline && i < (pipeline.publishRequested ? 6 : job?.finished ? 5 : 4) ? "done" : ""}><i />{s}</div>)}</div><div className="actionRow"><button className="ghostButton" onClick={() => create(false)} disabled={busy}>Regenerate</button><button className="button" onClick={publish} disabled={busy || !job?.finished || !pipeline || pipeline.publishRequested}>{pipeline?.publishRequested ? "Published ✓" : "Approve & publish →"}</button></div></section>
        <section className="panel previewPanel"><div className="panelHead"><div><span className="mutedLabel">PREVIEW</span><h2>Vertical render</h2></div><span>9:16</span></div><div className="previewPhone"><div className="previewScreen"><span className="topicPill">{pipeline?.idea.topic ?? "AI IN REAL LIFE"}</span><div className="orb smallOrb"><div className="orbCore" /></div><h3>{pipeline?.idea.hook ?? "AI IS MOVING FROM ANSWERS TO ACTIONS."}</h3><div className="captionLine"><span>{pipeline ? pipeline.idea.script.split(" ").slice(0,7).join(" ") : "Give it an outcome."}</span></div><div className="phoneFooter"><span>@facelesscreator</span><span>{job?.finished ? "READY" : "00:24"}</span></div></div></div><div className="renderInfo"><div><span>Render job</span><b>{pipeline?.renderJobId?.slice(0,18) ?? "Not started"}</b></div><div><span>Status</span><b>{job?.status ?? pipeline?.renderStatus ?? "idle"}</b></div></div></section>
      </div>
      <section className="panel queuePanel"><div className="panelHead"><div><span className="mutedLabel">QUEUE</span><h2>Content pipeline</h2></div><button className="plainButton">View calendar →</button></div><div className="queueRows"><QueueRow title="3 AI tools that quietly replaced a weekly task" platform="YT SHORTS / IG" status="Scheduled · 7:30 PM" score="94"/><QueueRow title="The interface is disappearing" platform="TIKTOK / IG" status="Review needed" score="91"/><QueueRow title="Why agents need memory, not bigger prompts" platform="YT SHORTS" status="Draft script" score="88"/></div></section>
    </section>
  </main>;
}
function Metric({ label, value, delta }: { label: string; value: string; delta: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>; }
function QueueRow({ title, platform, status, score }: { title: string; platform: string; status: string; score: string }) { return <div className="queueRow"><strong>{title}</strong><span>{platform}</span><span>{status}</span><b>{score}</b></div>; }
