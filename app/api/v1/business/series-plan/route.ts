import { z } from 'zod';
import { loadCharacterBusinessState } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const PlanInput = z.object({
  characterId: z.string().min(1),
  days: z.number().int().min(3).max(30).default(7),
});

const episodePatterns = [
  ['Pattern interrupt', 'Open with the character doing the recurring bit immediately, then reveal the unexpected setup.'],
  ['Escalation', 'Repeat the familiar bit but raise the stakes, location, prop, or consequence.'],
  ['Audience challenge', 'Turn a comment-style prompt into the next episode and invite a specific response.'],
  ['Callback', 'Bring back a recognizable detail from an earlier episode so returning viewers feel rewarded.'],
  ['Offer bridge', 'Make the product or affiliate offer a useful prop or outcome inside the story instead of a detached ad.'],
  ['Behind the character', 'Show a light origin, routine, training, setup, or pseudo-behind-the-scenes angle without breaking identity.'],
  ['Payoff', 'Deliver the cleanest version of the recurring gag and end with a loopable visual beat.'],
] as const;

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = PlanInput.parse(await request.json());
    const state = await loadCharacterBusinessState(workspace.id);
    const character = state.characters.find((item) => item.id === payload.characterId);
    if (!character) return Response.json({ ok: false, error: 'Character not found in this workspace' }, { status: 404 });

    const activeOffers = state.offers.filter((offer) => offer.characterId === character.id && offer.active);
    const preferredOffer = activeOffers.find((offer) => offer.kind !== 'platform') ?? activeOffers[0];
    const platforms = character.platforms.length > 0 ? character.platforms : ['facebook'];

    const episodes = Array.from({ length: payload.days }, (_, index) => {
      const [pattern, direction] = episodePatterns[index % episodePatterns.length];
      const platform = platforms[index % platforms.length];
      const monetize = Boolean(preferredOffer) && (index + 1) % 3 === 0;
      return {
        day: index + 1,
        platform,
        pattern,
        workingTitle: `${character.name}: ${pattern}`,
        creativeDirection: `${direction} Keep ${character.visualIdentity} consistent. The recurring bit is: ${character.recurringBit}`,
        hook: `${character.name} ${index === 0 ? 'does the thing viewers should recognize instantly' : 'returns with a new twist on the same recognizable behavior'}.`,
        cta: monetize && preferredOffer
          ? `Bridge naturally to “${preferredOffer.label}” only after the story payoff.`
          : 'Prioritize shares, follows, saves, and a comment prompt over a hard sell.',
        offerId: monetize ? preferredOffer?.id : undefined,
        estimatedGenerationCostCents: character.generationCostCents,
      };
    });

    const projectedCostCents = episodes.reduce((sum, episode) => sum + episode.estimatedGenerationCostCents, 0);
    const offerMix = activeOffers.reduce<Record<string, number>>((acc, offer) => {
      acc[offer.kind] = (acc[offer.kind] ?? 0) + 1;
      return acc;
    }, {});

    return Response.json({
      ok: true,
      character,
      plan: {
        days: payload.days,
        cadencePerWeek: character.cadencePerWeek,
        projectedCostCents,
        offerMix,
        episodes,
        guardrails: [
          'Preserve one recognizable character identity across episodes.',
          'Treat platform monetization as one revenue stream, not the business model.',
          'Measure revenue, cost, clicks and conversions alongside views.',
          'Use publishing APIs only for accounts the workspace owner has explicitly connected.',
        ],
      },
    });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create series plan';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
