import Link from "next/link";

const steps = [
  ["01", "Discover", "Turn a niche into ranked short-form ideas."],
  ["02", "Create", "Generate hooks, scripts, captions and a 9:16 render."],
  ["03", "Approve", "Keep human review in the loop or automate trusted channels."],
  ["04", "Learn", "Pull performance data back into the next content cycle."]
];

export default function Home() {
  return <main>
    <nav className="nav shell">
      <Link href="/" className="brand"><span className="brandMark">F</span> FACELESS CREATOR</Link>
      <div className="navLinks"><a href="#system">System</a><a href="#workflow">Workflow</a><a href="#principles">Principles</a></div>
      <Link className="button small" href="/dashboard">Open Studio <span>↗</span></Link>
    </nav>
    <section className="hero shell">
      <div className="eyebrow"><span className="pulse" /> AUTONOMOUS CONTENT SYSTEM</div>
      <h1>From an idea to a published short. <em>Without the production drag.</em></h1>
      <p className="heroCopy">A focused operating system for faceless channels: discover what to say, turn it into sharp vertical video, approve it, publish it, and learn what actually earns attention.</p>
      <div className="heroActions"><Link className="button" href="/dashboard">Launch the studio <span>→</span></Link><a className="textLink" href="#workflow">See how it works <span>↓</span></a></div>
      <div className="heroFrame" aria-label="Faceless Creator workflow preview">
        <div className="frameTop"><span>CONTENT RUN / 0142</span><span className="live"><i /> LIVE SYSTEM</span></div>
        <div className="frameGrid">
          <div className="frameCopy">
            <span className="mutedLabel">CURRENT IDEA</span><h2>AI agents are starting to use software like employees do.</h2>
            <div className="scoreRow"><span>Hook score</span><strong>92</strong><div className="scoreBar"><i style={{width:"92%"}} /></div></div>
            <p>“Instead of asking AI for an answer, you give it an outcome and let it work through the steps.”</p>
            <div className="stageRow"><b>Research</b><b>Script</b><b>Render</b><b className="activeStage">Review</b><b>Publish</b></div>
          </div>
          <div className="phoneMock"><div className="phoneInner"><span className="topicPill">AI IN REAL LIFE</span><div className="orb"><div className="orbCore" /></div><h3>AI IS MOVING<br/>FROM ANSWERS<br/><span>TO ACTIONS.</span></h3><div className="captionLine"><span>Give it an outcome.</span></div><div className="phoneFooter"><span>@facelesscreator</span><span>00:24</span></div></div></div>
        </div>
      </div>
    </section>
    <section className="statement" id="system"><div className="shell statementGrid"><p className="sectionIndex">/ 01 — SYSTEM</p><h2>Most automation stops when the MP4 exists. <span>That is where this starts getting useful.</span></h2><p className="sectionCopy">The creator tracks the whole loop—from an initial angle to actual platform performance—so the next post is informed by evidence instead of another blank prompt.</p></div></section>
    <section className="workflow shell" id="workflow"><p className="sectionIndex">/ 02 — WORKFLOW</p><div className="stepGrid">{steps.map(([num,title,copy]) => <article className="step" key={num}><span>{num}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="principles shell" id="principles"><div><p className="sectionIndex">/ 03 — PRINCIPLES</p><h2>Automation with an editorial spine.</h2></div><div className="principleList"><div><b>Human approval by default</b><p>Automation is powerful. Publishing weak content faster is not.</p></div><div><b>Provider-independent core</b><p>Orshot gets us moving quickly without becoming the architecture.</p></div><div><b>Performance closes the loop</b><p>Views, saves, retention and engagement become inputs to future planning.</p></div></div></section>
    <footer className="footer shell"><span>FACELESS CREATOR / 2026</span><Link href="/dashboard">OPEN STUDIO →</Link></footer>
  </main>;
}
