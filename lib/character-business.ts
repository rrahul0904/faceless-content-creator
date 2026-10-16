import { db } from '@/lib/db';

export type MonetizationKind = 'platform' | 'affiliate' | 'product' | 'service' | 'sponsorship';
export type RevenueSource = MonetizationKind | 'other';

export type CharacterProfile = {
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
  channelId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonetizationOffer = {
  id: string;
  characterId: string;
  label: string;
  kind: MonetizationKind;
  destinationUrl?: string;
  payoutCents?: number;
  commissionRate?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RevenueEvent = {
  id: string;
  characterId: string;
  offerId?: string;
  contentId?: string;
  platform: string;
  source: RevenueSource;
  amountCents: number;
  costCents: number;
  views: number;
  clicks: number;
  conversions: number;
  occurredAt: string;
  note?: string;
  createdAt: string;
};

export type CharacterBusinessState = {
  version: 1;
  characters: CharacterProfile[];
  offers: MonetizationOffer[];
  revenueEvents: RevenueEvent[];
};

const EMPTY_STATE: CharacterBusinessState = {
  version: 1,
  characters: [],
  offers: [],
  revenueEvents: [],
};

function stateKey(workspaceId: string) {
  return `character-business:${workspaceId}`;
}

function normalizeState(value: unknown): CharacterBusinessState {
  if (!value || typeof value !== 'object') return structuredClone(EMPTY_STATE);
  const candidate = value as Partial<CharacterBusinessState>;
  return {
    version: 1,
    characters: Array.isArray(candidate.characters) ? candidate.characters : [],
    offers: Array.isArray(candidate.offers) ? candidate.offers : [],
    revenueEvents: Array.isArray(candidate.revenueEvents) ? candidate.revenueEvents : [],
  };
}

export async function loadCharacterBusinessState(workspaceId: string) {
  const setting = await db.setting.findUnique({ where: { key: stateKey(workspaceId) } });
  if (!setting) return structuredClone(EMPTY_STATE);
  try {
    return normalizeState(JSON.parse(setting.value));
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

export async function saveCharacterBusinessState(workspaceId: string, state: CharacterBusinessState) {
  const normalized = normalizeState(state);
  await db.setting.upsert({
    where: { key: stateKey(workspaceId) },
    update: { value: JSON.stringify(normalized), encrypted: false },
    create: { key: stateKey(workspaceId), value: JSON.stringify(normalized), encrypted: false },
  });
  return normalized;
}

export function summarizeCharacterBusiness(state: CharacterBusinessState) {
  const totals = state.revenueEvents.reduce(
    (acc, event) => {
      acc.revenueCents += event.amountCents;
      acc.costCents += event.costCents;
      acc.views += event.views;
      acc.clicks += event.clicks;
      acc.conversions += event.conversions;
      acc.bySource[event.source] = (acc.bySource[event.source] ?? 0) + event.amountCents;
      return acc;
    },
    {
      revenueCents: 0,
      costCents: 0,
      views: 0,
      clicks: 0,
      conversions: 0,
      bySource: {} as Record<string, number>,
    },
  );

  const grossProfitCents = totals.revenueCents - totals.costCents;
  const rpmCents = totals.views > 0 ? Math.round((totals.revenueCents / totals.views) * 1000) : 0;
  const profitPerThousandViewsCents = totals.views > 0 ? Math.round((grossProfitCents / totals.views) * 1000) : 0;
  const clickThroughRate = totals.views > 0 ? totals.clicks / totals.views : 0;
  const conversionRate = totals.clicks > 0 ? totals.conversions / totals.clicks : 0;

  return {
    characterCount: state.characters.length,
    activeOfferCount: state.offers.filter((offer) => offer.active).length,
    eventCount: state.revenueEvents.length,
    ...totals,
    grossProfitCents,
    rpmCents,
    profitPerThousandViewsCents,
    clickThroughRate,
    conversionRate,
  };
}
