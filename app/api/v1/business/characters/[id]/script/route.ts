import { z } from 'zod';
import { generateScript } from '@/lib/content';
import { loadCharacterBusinessState } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const EpisodeScriptInput = z.object({
  episodeDirection: z.string().min(1).max(2000),
  platform: z.string().min(1).max(80).optional(),
  offerId: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const payload = EpisodeScriptInput.parse(await request.json());
    const state = await loadCharacterBusinessState(workspace.id);
    const character = state.characters.find((item) => item.id === id);
    if (!character) return Response.json({ ok: false, error: 'Character not found in this workspace' }, { status: 404 });

    const offer = payload.offerId
      ? state.offers.find((item) => item.id === payload.offerId && item.characterId === character.id && item.active)
      : undefined;
    if (payload.offerId && !offer) {
      return Response.json({ ok: false, error: 'Active offer not found for this character' }, { status: 404 });
    }

    const creativeContext = [
      `Character: ${character.name}`,
      `Persona: ${character.persona}`,
      `Visual identity contract: ${character.visualIdentity}`,
      `Recurring bit: ${character.recurringBit}`,
      `Target platform: ${payload.platform ?? character.platforms[0] ?? 'short-form social'}`,
      offer ? `Optional monetization bridge after the payoff: ${offer.label} (${offer.kind})` : 'No hard-sell offer is required for this episode.',
    ].join('\n');

    const result = await generateScript({
      niche: character.niche,
      idea: payload.episodeDirection,
      audience: character.audience,
      mode: 'character',
      creativeContext,
    });

    return Response.json({
      ok: true,
      characterId: character.id,
      identityContract: {
        name: character.name,
        persona: character.persona,
        visualIdentity: character.visualIdentity,
        recurringBit: character.recurringBit,
      },
      offer: offer ? { id: offer.id, label: offer.label, kind: offer.kind } : null,
      result,
      renderDefaults: {
        voice: 'en-us',
        speechRate: 165,
        template: 'editorial',
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to generate character episode script';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
