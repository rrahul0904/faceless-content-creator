import { Creator } from '@/components/creator';

const stages = [
  ['Idea', 'Start with a niche and a single topic'],
  ['Script', 'Create a short-form hook, narration and caption'],
  ['Voice', 'Generate speech locally with the bundled TTS engine'],
  ['Render', 'Compose subtitles and 9:16 video with FFmpeg'],
  ['Export', 'Review the MP4 and publish it wherever you want'],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">FACELESS</div>
        <div className="pill">Local-first content engine</div>
      </header>

      <section className="hero">
        <div className="heroCard">
          <div className="eyebrow">Faceless Content Creator</div>
          <h1>Turn an idea into a short. On your machine.</h1>
          <p className="muted">Write the script, synthesize the voice, burn animated-ready captions and render a vertical MP4 without sending your video job to a rendering SaaS.</p>
          <div className="ctaRow">
            <a className="button" href="#studio">Create a short</a>
            <a className="button secondary" href="#pipeline">How it works</a>
          </div>
        </div>
        <div className="heroCard preview">
          <div className="phone">
            <div className="eyebrow">LOCAL RENDER · 9:16</div>
            <div className="caption">Your hook, narration and captions become a real MP4 with FFmpeg.</div>
            <p className="muted">SQLite · local TTS · no renderer API key</p>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="stat"><strong>0</strong><span>Required API keys</span></div>
        <div className="stat"><strong>1</strong><span>Docker command to start</span></div>
        <div className="stat"><strong>9:16</strong><span>Native short-form output</span></div>
        <div className="stat"><strong>100%</strong><span>Local render ownership</span></div>
      </section>

      <div id="studio"><Creator /></div>

      <section className="panel" id="pipeline">
        <div className="panelHeader">
          <div><div className="eyebrow">Production pipeline</div><h2>No external rendering service in the critical path</h2></div>
          <div className="status"><span className="dot"/>Self-contained mode</div>
        </div>
        <div className="pipeline">{stages.map(([title, copy], i)=><div className="step" key={title}><small>0{i+1}</small><b>{title}</b><small>{copy}</small></div>)}</div>
      </section>
    </main>
  );
}
