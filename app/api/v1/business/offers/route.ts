import { z } from 'zod';
import { loadCharacterBusinessState, saveCharacterBusinessState } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const OfferInput = z.object({
  characterId: z.string().min(1),
  label: z.string().min(1).max(160),
  kind: z.enum(['platform', 'affiliate', 'product', 'service', 'sponsorship']),
  destinationUrl: z.string().url().optional(),
  payoutCents: z.number().int().min(0).max(100_000_000).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const state = await loadCharacterBusinessState(workspace.id);
    return Response.json({ ok: true, offers: state.offers });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load offers';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = OfferInput.parse(await request.json());
    const state = await loadCharacterBusinessState(workspace.id);
    if (!state.characters.some((character) => character.id === payload.characterId)) {
      return Response.json({ ok: false, error: 'Character not found in this workspace' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const offer = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    state.offers.unshift(offer);
    await saveCharacterBusinessState(workspace.id, state);
    return Response.json({ ok: true, offer }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create offer';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
