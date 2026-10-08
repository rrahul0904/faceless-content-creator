import { WorkflowStudio } from '@/components/workflow-studio';

export default function WorkflowsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">FACELESS</a>
        <div className="pill">Workflow Training Studio</div>
      </header>

      <section className="hero workflowHero">
        <div className="heroCard">
          <div className="eyebrow">Workflow → knowledge → training media</div>
          <h1>One workflow revision. Multiple trustworthy training artifacts.</h1>
          <p className="muted">Capture actions, compile a source-linked SOP, and render a narrated training MP4 through the same local-first media engine. Sensitive evidence remains blocked until review.</p>
          <div className="ctaRow">
            <a className="button" href="#workflow-studio">Try the working flow</a>
            <a className="button secondary" href="/">Back to creator</a>
          </div>
        </div>
        <div className="heroCard workflowPromise">
          <div className="eyebrow">System of record</div>
          <h2>StepGraph, not video.</h2>
          <p className="muted">The SOP and MP4 both retain an exact source revision. A later workflow change can invalidate only the affected outputs rather than forcing a blind full rebuild.</p>
          <div className="workflowFlow">
            <span>Capture</span><span>→</span><span>StepGraph</span><span>→</span><span>SOP + MP4</span>
          </div>
        </div>
      </section>

      <div id="workflow-studio"><WorkflowStudio /></div>
    </main>
  );
}
