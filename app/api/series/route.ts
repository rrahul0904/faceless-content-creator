import { z } from 'zod';
import { db } from '@/lib/db';
import { assertTimeZone, nextSeriesRun } from '@/lib/series';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const CreateSeries = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(120),
  brief: z.string().min(1).max(4000),
  audience: z.string().max(500).optional(),
  cadence: z.enum(['DAILY', 'WEEKDAYS', 'WEEKLY']).default('DAILY'),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  hour: z.number().int().min(0).max(23).default(9),
  minute: z.number().int().min(0).max(59).default(0),
  timezone: z.string().min(1).max(100).default('UTC'),
  approvalRequired: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const series = await db.series.findMany({
      where: { workspaceId: workspace.id },
      include: { channel: true },
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ ok: true, workspaceId: workspace.id, series });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to load series';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await resolveWorkspace(request);
    const payload = CreateSeries.parse(await request.json());
    assertTimeZone(payload.timezone);
    const channel = await db.channel.findFirst({ where: { id: payload.channelId, workspaceId: workspace.id } });
    if (!channel) return Response.json({ ok: false, error: 'Channel not found' }, { status: 404 });
    const nextRunAt = nextSeriesRun({
      cadence: payload.cadence,
      weekday: payload.weekday,
      hour: payload.hour,
      minute: payload.minute,
      timezone: payload.timezone,
    });
    const series = await db.series.create({
      data: { ...payload, workspaceId: workspace.id, nextRunAt },
      include: { channel: true },
    });
    return Response.json({ ok: true, series }, { status: 201 });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to create series';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
