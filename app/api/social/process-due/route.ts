import { db } from '@/lib/db';
import { startScheduledPublisher } from '@/lib/publish-worker';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const due = await db.publication.count({ where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } } });
  if (due) startScheduledPublisher(Math.min(due, 100));
  return Response.json({ ok: true, accepted: due, mode: 'async' }, { status: 202 });
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const [scheduled, failed, running] = await Promise.all([
    db.publication.count({ where: { status: 'SCHEDULED' } }),
    db.publication.count({ where: { status: 'FAILED' } }),
    db.publication.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'RETRY'] } } }),
  ]);
  return Response.json({ ok: true, scheduled, failed, running });
}
