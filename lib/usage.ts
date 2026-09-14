import { Prisma, type UsageKind } from '@prisma/client';
import { db } from '@/lib/db';

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordUsage(input: {
  workspaceId: string;
  kind: UsageKind;
  quantity?: number;
  unit?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: unknown;
}) {
  return db.usageEvent.create({
    data: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? 'unit',
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      metadata: input.metadata === undefined ? undefined : asJson(input.metadata),
    },
  });
}

export async function getUsageSummary(workspaceId: string, days = 30) {
  const normalizedDays = Math.max(1, Math.min(Math.floor(days), 366));
  const since = new Date(Date.now() - normalizedDays * 24 * 60 * 60 * 1000);
  const events = await db.usageEvent.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const totals: Record<string, { quantity: number; unit: string }> = {};
  for (const event of events) {
    const current = totals[event.kind] ?? { quantity: 0, unit: event.unit };
    current.quantity += event.quantity;
    current.unit = event.unit;
    totals[event.kind] = current;
  }

  const latestLedger = await db.creditLedger.findFirst({
    where: { workspaceId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  return {
    days: normalizedDays,
    since,
    totals,
    eventCount: events.length,
    creditBalance: latestLedger?.balanceAfter ?? 0,
    recent: events.slice(0, 50),
  };
}
