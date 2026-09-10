import { pendingRenderJobs, updateRenderRecord } from "../lib/db";
import { getRenderJob } from "../lib/orshot";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pollMs = Math.max(3000, Number(process.env.WORKER_POLL_MS ?? 8000));
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function cycle() {
  const ids = await pendingRenderJobs();
  if (!ids.length) return;
  await Promise.all(ids.map(async (id) => {
    try {
      const job = await getRenderJob(id);
      await updateRenderRecord(id, job.status, job.mediaUrl, job.error);
      console.log(JSON.stringify({ event: "render.reconciled", id, status: job.status, finished: job.finished }));
    } catch (error) {
      console.error(JSON.stringify({ event: "render.reconcile_failed", id, error: error instanceof Error ? error.message : String(error) }));
    }
  }));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the worker");
  if (process.env.DEMO_MODE !== "false") throw new Error("Set DEMO_MODE=false before running the production worker");
  console.log(JSON.stringify({ event: "worker.started", pollMs }));
  while (!stopping) {
    await cycle().catch((error) => console.error(JSON.stringify({ event: "worker.cycle_failed", error: String(error) })));
    await delay(pollMs);
  }
  console.log(JSON.stringify({ event: "worker.stopped" }));
}

main().catch((error) => { console.error(error); process.exit(1); });
