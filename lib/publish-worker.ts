import { spawn } from 'node:child_process';
import path from 'node:path';

export function startPublishWorker(publicationId: string) {
  const child = spawn(process.execPath, [path.join(process.cwd(), 'worker', 'publish-job.mjs'), publicationId], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export function startScheduledPublisher(limit = 25) {
  const child = spawn(process.execPath, [path.join(process.cwd(), 'worker', 'process-scheduled.mjs'), String(limit)], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}
