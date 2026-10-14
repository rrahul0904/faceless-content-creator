import { z } from 'zod';
import { db } from '@/lib/db';
import { assertTimeZone, nextSeriesRun } from '@/lib/series';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

const PatchSeries = z.object({
  name: z.string().min(1).max(120).optional(),
  brief: z.string().min(1).max(4000).optional(),
  audience: z.string().max(500).nullable().optional(),
  cadence: z.enum(['DAILY', 'WEEKDAYS', 'WEEKLY']).optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
  timezone: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  approvalRequired: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await resolveWorkspace(request);
    const { id } = await context.params;
    const payload = PatchSeries.parse(await request.json());
    const existing = await db.series.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return Response.json({ ok: false, error: 'Series not found' }, { status: 404 });

    const timezone = payload.timezone ?? existing.timezone;
    assertTimeZone(timezone);
    const cadence = payload.cadence ?? existing.cadence;
    const weekday = payload.weekday !== undefined ? payload.weekday : existing.weekday;
    const hour = payload.hour ?? existing.hour;
    const minute = payload.minute ?? existing.minute;
    const status = payload.status ?? existing.status;
    const nextRunAt = status === 'ACTIVE'
      ? nextSeriesRun({ cadence, weekday, hour, minute, timezone })
      : null;

    const series = await db.series.update({
      where: { id },
      data: { ...payload, nextRunAt },
      include: { channel: true },
    });
    return Response.json({ ok: true, series });
  } catch (error) {
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const message = error instanceof Error ? error.message : 'Unable to update series';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
