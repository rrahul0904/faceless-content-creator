import { z } from 'zod';
import { db } from '@/lib/db';
import { loadCharacterBusinessState, saveCharacterBusinessState } from '@/lib/character-business';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const CharacterInput = z.object({
  name: z.string().min(1).max(80),
  persona: z.string().min(1).max(160),
  niche: z.string().min(1).max(160),
  audience: z.string().min(1).max(240),
  visualIdentity: z.string().min(1).max(500),
  recurringBit: z.string().min(1).max(500),
  platforms: z.array(z.string().min(1)).min(1).max(8),
  cadencePerWeek: z.number().int().min(1).max(35).default(7),
  generationCostCents: z.number().int().min(0).max(1_000_000).default(0),
  channelId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const state = await loadCharacterBusinessState(workspace.id);
    return Response.json({ ok: true, characters: state.characters });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load character profiles';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = CharacterInput.parse(await request.json());

    if (payload.channelId) {
      const channel = await db.channel.findFirst({ where: { id: payload.channelId, workspaceId: workspace.id } });
      if (!channel) return Response.json({ ok: false, error: 'Channel not found in this workspace' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const state = await loadCharacterBusinessState(workspace.id);
    const character = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    state.characters.unshift(character);
    await saveCharacterBusinessState(workspace.id, state);
    return Response.json({ ok: true, character }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create character profile';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
