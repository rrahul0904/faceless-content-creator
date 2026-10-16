import { z } from 'zod';
import { loadCharacterBusinessState, saveCharacterBusinessState, summarizeCharacterBusiness } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const RevenueInput = z.object({
  characterId: z.string().min(1),
  offerId: z.string().optional(),
  contentId: z.string().optional(),
  platform: z.string().min(1).max(80),
  source: z.enum(['platform', 'affiliate', 'product', 'service', 'sponsorship', 'other']),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  costCents: z.number().int().min(0).max(1_000_000_000).default(0),
  views: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = RevenueInput.parse(await request.json());
    const state = await loadCharacterBusinessState(workspace.id);

    if (!state.characters.some((character) => character.id === payload.characterId)) {
      return Response.json({ ok: false, error: 'Character not found in this workspace' }, { status: 404 });
    }
    if (payload.offerId && !state.offers.some((offer) => offer.id === payload.offerId && offer.characterId === payload.characterId)) {
      return Response.json({ ok: false, error: 'Offer not found for this character' }, { status: 404 });
    }

    const event = {
      id: crypto.randomUUID(),
      ...payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.revenueEvents.unshift(event);
    await saveCharacterBusinessState(workspace.id, state);

    return Response.json({ ok: true, event, metrics: summarizeCharacterBusiness(state) }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to record revenue event';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
