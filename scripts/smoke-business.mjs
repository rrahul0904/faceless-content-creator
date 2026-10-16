const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const apiKey = process.env.SMOKE_API_KEY?.trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (apiKey) headers.set('authorization', `Bearer ${apiKey}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

const suffix = Date.now().toString(36);

const created = await request('/api/v1/business/characters', {
  method: 'POST',
  body: JSON.stringify({
    name: `Leo-${suffix}`,
    persona: 'Playful recurring dog character',
    niche: 'Funny AI animal skits',
    audience: 'Pet lovers and casual short-form viewers',
    visualIdentity: 'Same dog, same markings, same proportions and the same signature red bandana in every episode.',
    recurringBit: 'Leo turns an ordinary situation into an unexpected dance competition.',
    platforms: ['facebook', 'instagram', 'tiktok'],
    cadencePerWeek: 7,
    generationCostCents: 25,
  }),
});

assert(created.character?.id, 'character creation did not return an id');
const characterId = created.character.id;

const offerCreated = await request('/api/v1/business/offers', {
  method: 'POST',
  body: JSON.stringify({
    characterId,
    label: 'Smoke affiliate offer',
    kind: 'affiliate',
    active: true,
  }),
});
assert(offerCreated.offer?.id, 'offer creation did not return an id');

const revenueCreated = await request('/api/v1/business/revenue', {
  method: 'POST',
  body: JSON.stringify({
    characterId,
    offerId: offerCreated.offer.id,
    platform: 'facebook',
    source: 'affiliate',
    amountCents: 2500,
    costCents: 500,
    views: 10000,
    clicks: 80,
    conversions: 4,
    note: 'CI acceptance event',
  }),
});
assert(revenueCreated.metrics?.grossProfitCents >= 2000, 'gross profit metric was not updated');

const plan = await request('/api/v1/business/series-plan', {
  method: 'POST',
  body: JSON.stringify({ characterId, days: 7 }),
});
assert(plan.plan?.episodes?.length === 7, 'series planner did not return seven episodes');
assert(plan.plan.projectedCostCents === 175, `unexpected projected cost ${plan.plan.projectedCostCents}`);
assert(plan.plan.episodes.every((episode) => episode.creativeDirection.includes('Same dog')), 'series plan did not preserve visual identity');
assert(plan.plan.episodes.some((episode) => episode.offerId === offerCreated.offer.id), 'series plan did not include the active offer');

const monetizedEpisode = plan.plan.episodes.find((episode) => episode.offerId === offerCreated.offer.id) ?? plan.plan.episodes[0];
const script = await request(`/api/v1/business/characters/${encodeURIComponent(characterId)}/script`, {
  method: 'POST',
  body: JSON.stringify({
    episodeDirection: monetizedEpisode.creativeDirection,
    platform: monetizedEpisode.platform,
    offerId: monetizedEpisode.offerId,
  }),
});
assert(script.identityContract?.name === created.character.name, 'script response lost the character identity contract');
assert(script.identityContract?.visualIdentity.includes('Same dog'), 'script response lost visual identity requirements');
assert(script.result?.script?.includes('Visual identity contract') || script.result?.script?.includes('recurring character'), 'deterministic character script did not receive creative context');

const dashboard = await request('/api/v1/business');
assert(dashboard.state?.characters?.some((character) => character.id === characterId), 'character is missing from persisted dashboard state');
assert(dashboard.state?.offers?.some((offer) => offer.id === offerCreated.offer.id), 'offer is missing from persisted dashboard state');
assert(dashboard.metrics?.revenueCents >= 2500, 'dashboard revenue metric was not updated');
assert(dashboard.metrics?.grossProfitCents >= 2000, 'dashboard gross profit metric was not updated');
assert(dashboard.metrics?.views >= 10000, 'dashboard views metric was not updated');

console.log(JSON.stringify({
  ok: true,
  characterId,
  offerId: offerCreated.offer.id,
  revenueCents: dashboard.metrics.revenueCents,
  grossProfitCents: dashboard.metrics.grossProfitCents,
  plannedEpisodes: plan.plan.episodes.length,
  scriptTopic: script.result.topic,
}, null, 2));
