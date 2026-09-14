import { disconnect, publishPublication } from './social-publisher.mjs';

const publicationId = process.argv[2];
if (!publicationId) {
  console.error('Usage: node worker/publish-job.mjs <publication-id>');
  process.exit(2);
}

try {
  const result = await publishPublication(publicationId);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await disconnect();
}
