import { Prisma, type UsageKind, type Workspace, type WorkspacePlan } from '@prisma/client';
import { db } from '@/lib/db';

export type PlanLimits = {
  renderJobsPerMonth: number;
  aiVideoJobsPerMonth: number;
  socialPublishesPerMonth: number;
  storageMb: number;
  members: number;
  meteredRequestsPerMinute: number;
};

type WorkspaceIdentity = Pick<Workspace, 'id' | 'plan'>;

const DEFAULT_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  FREE: {
    renderJobsPerMonth: 20,
    aiVideoJobsPerMonth: 2,
    socialPublishesPerMonth: 10,
    storageMb: 1024,
    members: 1,
    meteredRequestsPerMinute: 30,
  },
  CREATOR: {
    renderJobsPerMonth: 200,
    aiVideoJobsPerMonth: 20,
    socialPublishesPerMonth: 100,
    storageMb: 10_240,
    members: 3,
    meteredRequestsPerMinute: 120,
  },
  PRO: {
    renderJobsPerMonth: 1000,
    aiVideoJobsPerMonth: 100,
    socialPublishesPerMonth: 500,
    storageMb: 51_200,
    members: 10,
    meteredRequestsPerMinute: 300,
  },
  BUSINESS: {
    renderJobsPerMonth: 5000,
    aiVideoJobsPerMonth: 500,
    socialPublishesPerMonth: 5000,
    storageMb: 256_000,
    members: 100,
    meteredRequestsPerMinute: 1200,
  },
};

const ENV_SUFFIX: Record<keyof PlanLimits, string> = {
  renderJobsPerMonth: 'RENDER_JOBS_PER_MONTH',
  aiVideoJobsPerMonth: 'AI_VIDEO_JOBS_PER_MONTH',
  socialPublishesPerMonth: 'SOCIAL_PUBLISHES_PER_MONTH',
  storageMb: 'STORAGE_MB',
  members: 'MEMBERS',
  meteredRequestsPerMinute: 'METERED_REQUESTS_PER_MINUTE',
};

const MONTHLY_LIMIT_KEY: Partial<Record<UsageKind, keyof PlanLimits>> = {
  RENDER_JOB: 'renderJobsPerMonth',
  AI_VIDEO_JOB: 'aiVideoJobsPerMonth',
  SOCIAL_PUBLISH: 'socialPublishesPerMonth',
  STORAGE_MB: 'storageMb',
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function limitsForPlan(plan: WorkspacePlan): PlanLimits {
  const defaults = DEFAULT_LIMITS[plan];
  return Object.fromEntries(
    (Object.keys(defaults) as Array<keyof PlanLimits>).map((key) => [
      key,
      positiveInteger(process.env[`FCC_${plan}_${ENV_SUFFIX[key]}`], defaults[key]),
    ]),
  ) as PlanLimits;
}

function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resetAt };
}

function rateWindow(now = new Date()) {
  const bucket = Math.floor(now.getTime() / 60_000);
  const resetAt = new Date((bucket + 1) * 60_000);
  return { bucket, resetAt };
}

function rateKey(workspaceId: string, bucket: number) {
  return `rate-limit:${workspaceId}:${bucket}`;
}

async function currentRateCount(workspaceId: string, now = new Date()) {
  const { bucket, resetAt } = rateWindow(now);
  const setting = await db.setting.findUnique({ where: { key: rateKey(workspaceId, bucket) } });
  return { used: Math.max(0, Number(setting?.value ?? 0) || 0), resetAt };
}

async function incrementRateCount(workspaceId: string, now = new Date()) {
  const { bucket, resetAt } = rateWindow(now);
  const key = rateKey(workspaceId, bucket);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const used = await db.$transaction(async (tx) => {
        const current = await tx.setting.findUnique({ where: { key } });
        const next = Math.max(0, Number(current?.value ?? 0) || 0) + 1;
        if (current) {
          await tx.setting.update({ where: { key }, data: { value: String(next), encrypted: false } });
        } else {
          await tx.setting.create({ data: { key, value: String(next), encrypted: false } });
        }
        return next;
      });

      void db.setting.deleteMany({
        where: {
          key: { startsWith: `rate-limit:${workspaceId}:` },
          updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) },
        },
      }).catch(() => undefined);

      return { used, resetAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 2) continue;
      throw error;
    }
  }

  return currentRateCount(workspaceId, now);
}

async function monthlyUsage(workspaceId: string, kind: UsageKind, since: Date) {
  if (kind === 'SOCIAL_PUBLISH') {
    return db.publication.count({
      where: {
        createdAt: { gte: since },
        content: { channel: { workspaceId } },
      },
    });
  }

  const aggregate = await db.usageEvent.aggregate({
    where: { workspaceId, kind, createdAt: { gte: since } },
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0;
}

export class PlanLimitError extends Error {
  status = 429;
  code: string;
  retryAfterSeconds?: number;
  details: Record<string, unknown>;

  constructor(input: {
    message: string;
    code: string;
    retryAfterSeconds?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'PlanLimitError';
    this.code = input.code;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.details = input.details ?? {};
  }
}

export async function enforceMeteredRate(workspace: WorkspaceIdentity) {
  const limit = limitsForPlan(workspace.plan).meteredRequestsPerMinute;
  const rate = await incrementRateCount(workspace.id);
  if (rate.used > limit) {
    throw new PlanLimitError({
      message: 'Workspace request rate limit exceeded',
      code: 'metered_rate_limited',
      retryAfterSeconds: Math.max(1, Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000)),
      details: {
        plan: workspace.plan,
        limit,
        used: rate.used,
        resetAt: rate.resetAt.toISOString(),
      },
    });
  }
  return rate;
}

export async function enforceUsageLimit(workspace: WorkspaceIdentity, kind: UsageKind, quantity = 1) {
  const requested = Math.max(0.000001, quantity);
  const limits = limitsForPlan(workspace.plan);
  const rate = await enforceMeteredRate(workspace);
  const key = MONTHLY_LIMIT_KEY[kind];
  if (!key) return { rate, monthly: null };

  const { start, resetAt } = monthWindow();
  const used = await monthlyUsage(workspace.id, kind, start);
  const limit = limits[key];
  if (used + requested > limit) {
    throw new PlanLimitError({
      message: `Monthly ${kind.toLowerCase()} quota exceeded`,
      code: 'quota_exceeded',
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
      details: {
        plan: workspace.plan,
        resource: kind,
        limit,
        used,
        requested,
        resetAt: resetAt.toISOString(),
      },
    });
  }

  return { rate, monthly: { kind, used, limit, requested, resetAt } };
}

export async function assertMemberCapacity(workspace: WorkspaceIdentity, additional = 1) {
  const requested = Math.max(1, additional);
  const limit = limitsForPlan(workspace.plan).members;
  const used = await db.membership.count({ where: { workspaceId: workspace.id } });
  if (used + requested > limit) {
    throw new PlanLimitError({
      message: 'Workspace member limit exceeded',
      code: 'membership_limit_exceeded',
      details: { plan: workspace.plan, resource: 'MEMBERS', limit, used, requested },
    });
  }
  return { used, limit, requested };
}

export async function getWorkspaceLimitSnapshot(workspace: WorkspaceIdentity) {
  const limits = limitsForPlan(workspace.plan);
  const { start, resetAt } = monthWindow();
  const [renderJobs, aiVideoJobs, socialPublishes, storageMb, members, rate] = await Promise.all([
    monthlyUsage(workspace.id, 'RENDER_JOB', start),
    monthlyUsage(workspace.id, 'AI_VIDEO_JOB', start),
    monthlyUsage(workspace.id, 'SOCIAL_PUBLISH', start),
    monthlyUsage(workspace.id, 'STORAGE_MB', start),
    db.membership.count({ where: { workspaceId: workspace.id } }),
    currentRateCount(workspace.id),
  ]);

  const resource = (used: number, limit: number) => ({ used, limit, remaining: Math.max(0, limit - used) });
  return {
    plan: workspace.plan,
    monthly: {
      startsAt: start.toISOString(),
      resetsAt: resetAt.toISOString(),
      renderJobs: resource(renderJobs, limits.renderJobsPerMonth),
      aiVideoJobs: resource(aiVideoJobs, limits.aiVideoJobsPerMonth),
      socialPublishes: resource(socialPublishes, limits.socialPublishesPerMonth),
      storageMb: resource(storageMb, limits.storageMb),
    },
    members: resource(members, limits.members),
    rate: {
      used: rate.used,
      limit: limits.meteredRequestsPerMinute,
      remaining: Math.max(0, limits.meteredRequestsPerMinute - rate.used),
      resetsAt: rate.resetAt.toISOString(),
    },
  };
}

export function planLimitResponse(error: unknown) {
  if (!(error instanceof PlanLimitError)) return null;
  const headers: Record<string, string> = {};
  if (error.retryAfterSeconds) headers['Retry-After'] = String(error.retryAfterSeconds);
  return Response.json({
    ok: false,
    error: error.message,
    code: error.code,
    limit: error.details,
  }, { status: error.status, headers });
}
