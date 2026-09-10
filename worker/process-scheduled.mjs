import { disconnect, processDuePublications } from './social-publisher.mjs';

const limit = Number(process.argv[2] || 25);

try {
  const results = await processDuePublications(limit);
  console.log(JSON.stringify({ ok: true, processed: results.length, results }));
  if (results.some((item) => item?.ok === false && !item?.skipped)) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await disconnect();
}
