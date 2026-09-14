import { spawn } from 'node:child_process';
import path from 'node:path';

export function startRenderWorker(jobId: string) {
  const workerPath = path.join(process.cwd(), 'worker', 'render-job.mjs');
  const child = spawn(process.execPath, [workerPath, jobId], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
}
