const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const smokeApiKey = process.env.SMOKE_API_KEY ?? '';

if (!smokeApiKey.startsWith('fcc_')) throw new Error('SMOKE_API_KEY is required for limits smoke');

function headers(extra = {}) {
  return { Authorization: `Bearer ${smokeApiKey}`, ...extra };
}

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: headers(init.headers ?? {}),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function json(pathname, init = {}) {
  const result = await request(pathname, init);
  if (!result.response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${result.response.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function expectStatus(pathname, status, init = {}) {
  const result = await request(pathname, init);
  if (result.response.status !== status) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} returned ${result.response.status}, expected ${status}: ${JSON.stringify(result.body)}`);
  }
  return result;
}

const before = await json('/api/v1/limits');
if (before.data?.plan !== 'FREE') throw new Error(`Unexpected test plan: ${JSON.stringify(before)}`);
if (before.data?.monthly?.renderJobs?.limit !== 2 || before.data?.monthly?.renderJobs?.used < 2) {
  throw new Error(`Render quota override or usage accounting is wrong: ${JSON.stringify(before.data?.monthly?.renderJobs)}`);
}
if (before.data?.monthly?.storageMb?.limit !== 1 || before.data?.monthly?.storageMb?.used <= 0) {
  throw new Error(`Storage quota override or upload accounting is wrong: ${JSON.stringify(before.data?.monthly?.storageMb)}`);
}
if (before.data?.members?.limit !== 1) throw new Error(`Membership limit override was not applied: ${JSON.stringify(before.data?.members)}`);
if (before.data?.rate?.limit !== 7 || before.data?.rate?.used < 5) {
  throw new Error(`Metered rate override or accounting is wrong: ${JSON.stringify(before.data?.rate)}`);
}

const member = await json('/api/v1/memberships', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@example.test', name: 'CI Owner', role: 'OWNER' }),
});
const membershipId = member.data?.id;
if (!membershipId || member.data?.role !== 'OWNER' || member.created !== true) {
  throw new Error(`Membership creation failed: ${JSON.stringify(member)}`);
}

const listed = await json('/api/v1/memberships');
if (!listed.data?.some((item) => item.id === membershipId && item.user?.email === 'owner@example.test')) {
  throw new Error(`Created membership was not listed: ${JSON.stringify(listed)}`);
}

const lastOwnerPatch = await expectStatus(`/api/v1/memberships/${encodeURIComponent(membershipId)}`, 409, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'ADMIN' }),
});
if (!String(lastOwnerPatch.body?.error ?? '').includes('retain at least one owner')) {
  throw new Error(`Last-owner demotion did not fail closed: ${JSON.stringify(lastOwnerPatch.body)}`);
}

const overMemberLimit = await expectStatus('/api/v1/memberships', 429, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'second@example.test', role: 'EDITOR' }),
});
if (overMemberLimit.body?.code !== 'membership_limit_exceeded') {
  throw new Error(`Membership quota returned wrong error: ${JSON.stringify(overMemberLimit.body)}`);
}

const lastOwnerDelete = await expectStatus(`/api/v1/memberships/${encodeURIComponent(membershipId)}`, 409, { method: 'DELETE' });
if (!String(lastOwnerDelete.body?.error ?? '').includes('retain at least one owner')) {
  throw new Error(`Last-owner deletion did not fail closed: ${JSON.stringify(lastOwnerDelete.body)}`);
}

const oversizedForm = new FormData();
oversizedForm.append('file', new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'video/mp4' }), 'quota-test.mp4');
const storageRejected = await expectStatus('/api/media', 429, { method: 'POST', body: oversizedForm });
if (storageRejected.body?.code !== 'quota_exceeded' || storageRejected.body?.limit?.resource !== 'STORAGE_MB') {
  throw new Error(`Storage quota rejection was not certified: ${JSON.stringify(storageRejected.body)}`);
}

const bootstrap = await json('/api/v1/templates/bootstrap', { method: 'POST' });
const templateId = bootstrap.data?.[0]?.id;
if (!templateId) throw new Error(`Template bootstrap returned no template: ${JSON.stringify(bootstrap)}`);

const renderRequest = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modifications: {}, response: { format: 'mp4', mode: 'async' } }),
};

const quotaRejected = await expectStatus(`/api/v1/templates/${encodeURIComponent(templateId)}/render`, 429, renderRequest);
if (quotaRejected.body?.code !== 'quota_exceeded' || quotaRejected.body?.limit?.resource !== 'RENDER_JOB') {
  throw new Error(`Monthly render quota rejection was not certified: ${JSON.stringify(quotaRejected.body)}`);
}
if (!quotaRejected.response.headers.get('retry-after')) throw new Error('Render quota response did not include Retry-After');

const rateRejected = await expectStatus(`/api/v1/templates/${encodeURIComponent(templateId)}/render`, 429, renderRequest);
if (rateRejected.body?.code !== 'metered_rate_limited') {
  throw new Error(`Rate-limit rejection was not certified: ${JSON.stringify(rateRejected.body)}`);
}
if (!rateRejected.response.headers.get('retry-after')) throw new Error('Rate-limit response did not include Retry-After');

const after = await json('/api/v1/limits');
if (
  after.data?.members?.used !== 1 ||
  after.data?.rate?.used < 8 ||
  after.data?.monthly?.renderJobs?.used < 2 ||
  after.data?.monthly?.storageMb?.used <= 0
) {
  throw new Error(`Limit snapshot did not reflect exercised controls: ${JSON.stringify(after)}`);
}

console.log(JSON.stringify({
  ok: true,
  workspaceId: after.data.workspaceId,
  plan: after.data.plan,
  renderJobs: after.data.monthly.renderJobs,
  storageMb: after.data.monthly.storageMb,
  members: after.data.members,
  rate: after.data.rate,
  certified: [
    'workspace-storage-accounting',
    'storage-quota',
    'membership-cap',
    'last-owner-guard',
    'monthly-render-quota',
    'metered-rate-limit',
  ],
}));
