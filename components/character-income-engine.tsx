'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Character = {
  id: string;
  name: string;
  persona: string;
  niche: string;
  audience: string;
  visualIdentity: string;
  recurringBit: string;
  platforms: string[];
  cadencePerWeek: number;
  generationCostCents: number;
};

type Offer = {
  id: string;
  characterId: string;
  label: string;
  kind: string;
  active: boolean;
};

type Dashboard = {
  state: { characters: Character[]; offers: Offer[] };
  metrics: {
    revenueCents: number;
    costCents: number;
    grossProfitCents: number;
    views: number;
    rpmCents: number;
    profitPerThousandViewsCents: number;
    conversions: number;
  };
  social: { publicationCount: number };
};

type SeriesPlan = {
  days: number;
  projectedCostCents: number;
  episodes: Array<{
    day: number;
    platform: string;
    pattern: string;
    workingTitle: string;
    creativeDirection: string;
    cta: string;
  }>;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function CharacterIncomeEngine() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [plan, setPlan] = useState<SeriesPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('Leo');
  const [persona, setPersona] = useState('Playful recurring dog character');
  const [niche, setNiche] = useState('Funny AI animal skits');
  const [audience, setAudience] = useState('Pet lovers and casual short-form viewers');
  const [visualIdentity, setVisualIdentity] = useState('Keep the same recognizable dog, face, markings, proportions and signature accessory in every episode.');
  const [recurringBit, setRecurringBit] = useState('Leo enters an ordinary situation and unexpectedly turns it into a dance competition.');
  const [platforms, setPlatforms] = useState('facebook, instagram, tiktok');
  const [cadence, setCadence] = useState(7);
  const [generationCost, setGenerationCost] = useState('0.25');

  const [offerLabel, setOfferLabel] = useState('Primary affiliate offer');
  const [offerKind, setOfferKind] = useState('affiliate');

  const [revenueSource, setRevenueSource] = useState('affiliate');
  const [revenuePlatform, setRevenuePlatform] = useState('facebook');
  const [revenueAmount, setRevenueAmount] = useState('0');
  const [revenueCost, setRevenueCost] = useState('0');
  const [revenueViews, setRevenueViews] = useState('0');
  const [revenueClicks, setRevenueClicks] = useState('0');
  const [revenueConversions, setRevenueConversions] = useState('0');

  const selected = useMemo(
    () => dashboard?.state.characters.find((character) => character.id === selectedId) ?? null,
    [dashboard, selectedId],
  );

  async function refresh() {
    const response = await fetch('/api/v1/business', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to load business dashboard');
    setDashboard(data);
    if (!selectedId && data.state.characters[0]) setSelectedId(data.state.characters[0].id);
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load business dashboard'));
    // selectedId is intentionally not a dependency; refresh should not loop when selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCharacter(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/business/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          persona,
          niche,
          audience,
          visualIdentity,
          recurringBit,
          platforms: platforms.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
          cadencePerWeek: cadence,
          generationCostCents: Math.round(Number(generationCost || 0) * 100),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to create character');
      setSelectedId(data.character.id);
      setPlan(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create character');
    } finally {
      setBusy(false);
    }
  }

  async function createOffer(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/business/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selectedId, label: offerLabel, kind: offerKind, active: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to create offer');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create offer');
    } finally {
      setBusy(false);
    }
  }

  async function recordRevenue(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/business/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedId,
          platform: revenuePlatform,
          source: revenueSource,
          amountCents: Math.round(Number(revenueAmount || 0) * 100),
          costCents: Math.round(Number(revenueCost || 0) * 100),
          views: Number(revenueViews || 0),
          clicks: Number(revenueClicks || 0),
          conversions: Number(revenueConversions || 0),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to record revenue');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record revenue');
    } finally {
      setBusy(false);
    }
  }

  async function generateSeries() {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/business/series-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selectedId, days: 7 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to create series plan');
      setPlan(data.plan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create series plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" id="character-business">
      <div className="panelHeader">
        <div>
          <div className="eyebrow">Character Income Engine</div>
          <h2>Build a recurring audience asset, then optimize the business behind it.</h2>
        </div>
        <div className="status"><span className="dot" />Revenue-aware</div>
      </div>

      {dashboard && (
        <div className="grid">
          <div className="stat"><strong>{money(dashboard.metrics.revenueCents)}</strong><span>Tracked revenue</span></div>
          <div className="stat"><strong>{money(dashboard.metrics.grossProfitCents)}</strong><span>Gross profit</span></div>
          <div className="stat"><strong>{money(dashboard.metrics.rpmCents)}</strong><span>Blended revenue / 1K views</span></div>
          <div className="stat"><strong>{money(dashboard.metrics.profitPerThousandViewsCents)}</strong><span>Profit / 1K views</span></div>
        </div>
      )}

      {error && <div className="errorBox">{error}</div>}

      <form className="creatorForm" onSubmit={createCharacter}>
        <label>Character name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Persona<input value={persona} onChange={(event) => setPersona(event.target.value)} /></label>
        <label>Niche<input value={niche} onChange={(event) => setNiche(event.target.value)} /></label>
        <label>Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label>
        <label>Visual identity<textarea rows={3} value={visualIdentity} onChange={(event) => setVisualIdentity(event.target.value)} /></label>
        <label>Recurring bit<textarea rows={3} value={recurringBit} onChange={(event) => setRecurringBit(event.target.value)} /></label>
        <label>Platforms<input value={platforms} onChange={(event) => setPlatforms(event.target.value)} /></label>
        <label>Posts / week<input type="number" min="1" max="35" value={cadence} onChange={(event) => setCadence(Number(event.target.value))} /></label>
        <label>Generation cost / post ($)<input type="number" min="0" step="0.01" value={generationCost} onChange={(event) => setGenerationCost(event.target.value)} /></label>
        <button className="button" disabled={busy}>{busy ? 'Working…' : 'Save character'}</button>
      </form>

      {dashboard && dashboard.state.characters.length > 0 && (
        <div className="resultCard">
          <div className="eyebrow">Owned characters</div>
          <label>
            Active character
            <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setPlan(null); }}>
              {dashboard.state.characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.niche}</option>)}
            </select>
          </label>
          {selected && <p className="muted">{selected.visualIdentity} Recurring bit: {selected.recurringBit}</p>}
          <div className="ctaRow"><button className="button secondary" type="button" onClick={generateSeries} disabled={busy}>Generate 7-day series</button></div>
        </div>
      )}

      {selected && (
        <div className="grid">
          <form className="resultCard" onSubmit={createOffer}>
            <div className="eyebrow">Monetization lane</div>
            <h3>Add an offer</h3>
            <label>Label<input value={offerLabel} onChange={(event) => setOfferLabel(event.target.value)} /></label>
            <label>Type<select value={offerKind} onChange={(event) => setOfferKind(event.target.value)}><option value="affiliate">Affiliate</option><option value="product">Product</option><option value="service">Service</option><option value="sponsorship">Sponsorship</option><option value="platform">Platform monetization</option></select></label>
            <button className="button secondary" disabled={busy}>Add offer</button>
          </form>

          <form className="resultCard" onSubmit={recordRevenue}>
            <div className="eyebrow">Unit economics</div>
            <h3>Record a result</h3>
            <label>Source<select value={revenueSource} onChange={(event) => setRevenueSource(event.target.value)}><option value="affiliate">Affiliate</option><option value="product">Product</option><option value="service">Service</option><option value="sponsorship">Sponsorship</option><option value="platform">Platform</option><option value="other">Other</option></select></label>
            <label>Platform<input value={revenuePlatform} onChange={(event) => setRevenuePlatform(event.target.value)} /></label>
            <label>Revenue ($)<input type="number" min="0" step="0.01" value={revenueAmount} onChange={(event) => setRevenueAmount(event.target.value)} /></label>
            <label>Cost ($)<input type="number" min="0" step="0.01" value={revenueCost} onChange={(event) => setRevenueCost(event.target.value)} /></label>
            <label>Views<input type="number" min="0" value={revenueViews} onChange={(event) => setRevenueViews(event.target.value)} /></label>
            <label>Clicks<input type="number" min="0" value={revenueClicks} onChange={(event) => setRevenueClicks(event.target.value)} /></label>
            <label>Conversions<input type="number" min="0" value={revenueConversions} onChange={(event) => setRevenueConversions(event.target.value)} /></label>
            <button className="button secondary" disabled={busy}>Record result</button>
          </form>
        </div>
      )}

      {plan && (
        <div className="resultCard">
          <div className="eyebrow">7-day recurring-series plan · projected generation cost {money(plan.projectedCostCents)}</div>
          <h3>Consistency first; monetization is woven into the series.</h3>
          <div className="pipeline">
            {plan.episodes.map((episode) => (
              <div className="step" key={`${episode.day}-${episode.platform}`}>
                <small>DAY {episode.day} · {episode.platform.toUpperCase()}</small>
                <b>{episode.pattern}</b>
                <small>{episode.creativeDirection}</small>
                <small>{episode.cta}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
