'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import './creative-production.css';

type BrandAsset = { id: string; name: string; type: string };
type Shot = { id: string; role: string; startSeconds: number; endSeconds: number;
  spoken: string; productAssetId: string; visualAnchors: string[]; evidence: Array<{ text: string; sourceUrl: string }>; pacing: { wordCount: number; estimatedSpeechSeconds: number; assumptionWordsPerMinute: number; slotSeconds: number; potentialOverrun: boolean } };
type Preview = {
  previewId: string;
  concept: { name: string; format: string; audience: string; channel: string;
    aspectRatio: string; durationSeconds: number };
  shots: Shot[];
  evidenceStatus: string;
  controls: { generationAllowed: boolean; publishingAllowed: boolean;
    quote: { estimatedUsd: number | null }; requiredGates: string[] };
};

export default function CreativeProductionPage() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [assetId, setAssetId] = useState('');
  const [assetError, setAssetError] = useState('');
  const [name, setName] = useState('');
  const [anchors, setAnchors] = useState('');
  const [claim, setClaim] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [audience, setAudience] = useState('');
  const [format, setFormat] = useState<'ugc' | 'product-ad' | 'cartoon-ad'>('ugc');
  const [objective, setObjective] = useState<'awareness' | 'consideration' | 'conversion'>('awareness');
  const [channel, setChannel] = useState<'instagram' | 'tiktok' | 'youtube' | 'linkedin'>('instagram');
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/brand-assets?type=IMAGE', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error || 'Unable to list workspace assets');
        if (!active) return;
        const images = (body.data as BrandAsset[]).filter(a => a.type === 'IMAGE');
        setAssets(images);
        setAssetId(current => current || images[0]?.id || '');
      })
      .catch(cause => { if (active) setAssetError(cause instanceof Error ? cause.message : 'Unable to load assets'); });
    return () => { active = false; };
  }, []);

  async function createPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPreview(null);
    if (!assetId) { setError('Select an existing workspace-owned product image first.'); return; }
    const visualAnchors = anchors.split(',').map(x => x.trim()).filter(Boolean);
    setLoading(true);
    try {
      const response = await fetch('/api/v1/creative-production/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: { name, assetId, visualAnchors, claims: [{ text: claim, sourceUrl }] },
          brief: { format, audience, objective, channel, durationSeconds: duration },
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        const details = Array.isArray(body.issues) ? body.issues.map((x: { message: string }) => x.message).join('; ') : '';
        throw new Error(details || body.error || 'Preview failed');
      }
      setPreview(body.data as Preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to build preview');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="cpPage">
      <header className="cpHeader">
        <Link className="cpBack" href="/">← Creator Console</Link>
        <span className="cpTag">REA · ZERO-SPEND PREPRODUCTION</span>
        <h1>Creative production</h1>
        <p>Turn workspace-owned product references into a time-coded concept and shot plan. Review first; generating or publishing media is not enabled here.</p>
      </header>

      <div className="cpLayout">
        <section className="cpPanel" aria-labelledby="cpBriefTitle">
          <h2 id="cpBriefTitle">Your production brief</h2>
          {assetError && <p className="cpAlert" role="alert">{assetError}. Hosted mode requires an authenticated workspace session.</p>}
          {assets.length === 0 && !assetError && <p className="cpHint">No workspace image assets found. Add one through the Creator Console asset API before creating a preview.</p>}
          <form onSubmit={createPreview}>
            <label htmlFor="cpAsset">Workspace product image</label>
            <select id="cpAsset" required value={assetId} onChange={e => setAssetId(e.target.value)} disabled={!assets.length}>
              {!assets.length && <option value="">No images available</option>}
              {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · {asset.id}</option>)}
            </select>

            <label htmlFor="cpName">Product name</label>
            <input id="cpName" value={name} onChange={e => setName(e.target.value)} maxLength={120} required placeholder="Product name from your source image" />

            <label htmlFor="cpAnchors">Visible identity anchors (comma-separated)</label>
            <textarea id="cpAnchors" value={anchors} onChange={e => setAnchors(e.target.value)} rows={2} maxLength={620} required placeholder="Color, shape, material, unique details visible in the reference" />
            <small>Enter 1–5 directly observed details. They remain attached to every shot.</small>

            <label htmlFor="cpClaim">One product claim</label>
            <textarea id="cpClaim" value={claim} onChange={e => setClaim(e.target.value)} rows={2} maxLength={240} required placeholder="A factual claim you can substantiate" />
            <label htmlFor="cpSource">Public HTTPS source for that claim</label>
            <input id="cpSource" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} required placeholder="https://example.com/product" />
            <small>We retain the link but do not independently verify its contents.</small>

            <label htmlFor="cpAudience">Target audience</label>
            <input id="cpAudience" value={audience} onChange={e => setAudience(e.target.value)} maxLength={160} required placeholder="Who is the creative for?" />

            <div className="cpOptions">
              <div><label htmlFor="cpFormat">Creative format</label>
                <select id="cpFormat" value={format} onChange={e => setFormat(e.target.value as typeof format)}>
                  <option value="ugc">Synthetic creator UGC</option>
                  <option value="product-ad">Product advertisement</option>
                  <option value="cartoon-ad">Cartoon advertisement</option>
                </select></div>
              <div><label htmlFor="cpObjective">Objective</label>
                <select id="cpObjective" value={objective} onChange={e => setObjective(e.target.value as typeof objective)}>
                  <option value="awareness">Awareness</option>
                  <option value="consideration">Consideration</option>
                  <option value="conversion">Conversion</option>
                </select></div>
              <div><label htmlFor="cpChannel">Channel</label>
                <select id="cpChannel" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}>
                  <option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option>
                </select></div>
              <div><label htmlFor="cpDuration">Duration</label>
                <select id="cpDuration" value={duration} onChange={e => setDuration(Number(e.target.value) as typeof duration)}>
                  {[15, 30, 45, 60].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                </select></div>
            </div>

            {error && <p className="cpAlert" role="alert">{error}</p>}
            <button className="cpSubmit" disabled={loading || !assetId} type="submit">
              {loading ? 'Building preview…' : 'Preview shot plan — no charges'}
            </button>
          </form>
        </section>

        <section className="cpPanel" aria-label="Production preview" aria-live="polite">
          <h2>Production storyboard</h2>
          {!preview ? (
            <div className="cpEmpty">
              <div className="cpEmptySymbol">▣</div>
              <strong>Nothing rendered or charged.</strong>
              <p>Submit a sourced brief to see scripted shots, asset-continuity locks and required approval gates.</p>
            </div>
          ) : (
            <>
              <div className="cpSummary">
                <strong>{preview.concept.name}</strong>
                <span>{preview.concept.format} · {preview.concept.durationSeconds}s · {preview.concept.aspectRatio}</span>
                <small>Preview ID: <code>{preview.previewId.slice(0, 25)}…</code></small>
              </div>
              <ol className="cpShots">
                {preview.shots.map(shot => <li key={shot.id}>
                  <div className="cpShotHead"><strong>{shot.role.replaceAll('-', ' ')}</strong>
                    <time>{shot.startSeconds}–{shot.endSeconds}s</time></div>
                  <p>{shot.spoken}</p>
                  <small role={shot.pacing.potentialOverrun ? 'status' : undefined}>
                    Voiceover estimate: {shot.pacing.estimatedSpeechSeconds}s at {shot.pacing.assumptionWordsPerMinute} wpm for a {shot.pacing.slotSeconds}s shot.
                    {shot.pacing.potentialOverrun ? ' Potential narration overrun — shorten the claim before approval.' : ' Actual voiceover timing must still be reviewed.'}
                  </small>
                  <small>Same product image: {shot.productAssetId}</small>
                  <small>Identity anchors: {shot.visualAnchors.join(' · ')}</small>
                  {shot.evidence.map(item => <small key={item.sourceUrl}>
                    Source pointer: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open supporting link</a>
                  </small>)}
                </li>)}
              </ol>
              <div className="cpSafety">
                <strong>Before any generation</strong>
                <p>Model quote required · human approvals required · no media or posting enabled.</p>
                <p>Claims linked, not independently fact-checked; synthetic-media disclosure is required.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
