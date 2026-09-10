const stages = [
  ['Discover', 'Find high-potential topics'],
  ['Script', 'Hook, story, caption & CTA'],
  ['Generate', 'Voice, presenter, b-roll & render'],
  ['Approve', 'Human review before publish'],
  ['Publish', 'Schedule, post and learn'],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">FACeless</div>
        <div className="pill">Autonomous content OS</div>
      </header>

      <section className="hero">
        <div className="heroCard">
          <div className="eyebrow">Faceless Content Creator</div>
          <h1>One idea in. A week of shorts out.</h1>
          <p className="muted">Discover topics, research claims, write scripts, render vertical video, approve, publish and learn from performance without living inside an automation canvas.</p>
          <div className="ctaRow">
            <button className="button">Create a channel</button>
            <button className="button secondary">View content queue</button>
          </div>
        </div>
        <div className="heroCard preview">
          <div className="phone">
            <div className="eyebrow">AI EXPLAINED · 00:31</div>
            <div className="caption">Why your next AI agent will need a memory layer.</div>
            <p className="muted">Karaoke captions · cinematic b-roll · scheduled everywhere</p>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="stat"><strong>12</strong><span>Ready to review</span></div>
        <div className="stat"><strong>07</strong><span>Scheduled today</span></div>
        <div className="stat"><strong>91%</strong><span>Render success</span></div>
        <div className="stat"><strong>+28%</strong><span>7-day completion rate</span></div>
      </section>

      <section className="panel">
        <div className="panelHeader"><div><div className="eyebrow">Production pipeline</div><h2>From signal to published short</h2></div><div className="status"><span className="dot"/>System healthy</div></div>
        <div className="pipeline">{stages.map(([title, copy], i)=><div className="step" key={title}><small>0{i+1}</small><b>{title}</b><small>{copy}</small></div>)}</div>
      </section>
    </main>
  );
}
