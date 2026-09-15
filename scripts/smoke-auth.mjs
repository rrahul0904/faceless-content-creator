const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3001';
const apiKey = process.env.SMOKE_API_KEY ?? '';

async function body(response) {
  return response.json().catch(() => ({}));
}

async function expect(path, expectedStatus, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const payload = await body(response);
  if (response.status !== expectedStatus) {
    throw new Error(`GET ${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.ok) break;
  } catch {
    // Container may still be starting.
  }
  if (attempt === 39) throw new Error('Hosted-auth container did not become healthy');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

await expect('/api/v1/workspace', 401);
await expect('/api/v1/workspace', 401, { Authorization: 'Bearer fcc_invalid_key_for_hosted_smoke' });
await expect('/api/v1/workspace', 401, { 'x-workspace-slug': 'local' });

if (!apiKey.startsWith('fcc_')) throw new Error('Hosted auth smoke did not receive a generated API key');
const authenticated = await expect('/api/v1/workspace', 200, { Authorization: `Bearer ${apiKey}` });
if (authenticated.data?.workspace?.slug !== 'local') {
  throw new Error(`Generated API key resolved an unexpected workspace: ${JSON.stringify(authenticated)}`);
}

console.log(JSON.stringify({
  ok: true,
  authMode: 'api-key',
  workspaceId: authenticated.data.workspace.id,
  workspaceSlug: authenticated.data.workspace.slug,
}));
