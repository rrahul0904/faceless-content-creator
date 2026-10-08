import postgres from 'npm:postgres@3.4.7'

const DATABASE_URL = Deno.env.get('SUPABASE_DB_URL') || ''
const MAX_BODY_BYTES = 2 * 1024 * 1024
const sql = postgres(DATABASE_URL, { max: 2, prepare: false, idle_timeout: 20 })

type Json = Record<string, unknown>

class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(message: string, status = 400, code = 'INVALID_REQUEST', details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Json).sort().map((key) => [key, canonical((value as Json)[key])]))
  }
  return value
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function receiptHash(value: unknown) {
  return sha256Hex(JSON.stringify(canonical(value)))
}

function asIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(String(value))
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString()
}

function boundedLimit(value: string | null, fallback: number, max: number) {
  return Math.max(1, Math.min(max, Number(value) || fallback))
}

async function readJson(req: Request) {
  const text = await req.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new ApiError('request body too large', 413, 'BODY_TOO_LARGE')
  if (!text) return {}
  try { return JSON.parse(text) } catch { throw new ApiError('invalid json body', 400, 'INVALID_JSON') }
}

function apiPath(url: URL) {
  const marker = '/creator-data'
  const index = url.pathname.indexOf(marker)
  if (index < 0) return url.pathname
  const path = url.pathname.slice(index + marker.length)
  return path || '/'
}

async function authorized(req: Request) {
  const token = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const tokenHash = await sha256Hex(token)
  const rows = await sql`
    select name
    from creator_private.service_credentials
    where token_hash = ${tokenHash} and revoked_at is null
    limit 1
  `
  return rows.length === 1
}

function validateBundle(input: any) {
  const brief = input?.brief || input
  if (!brief || !String(brief.id || '').trim() || !String(brief.topic || '').trim()) {
    throw new ApiError('brief.id and brief.topic are required', 400, 'INVALID_BRIEF')
  }
  const sources = Array.isArray(input?.sources ?? brief.sources) ? (input?.sources ?? brief.sources) : []
  const claims = Array.isArray(input?.claims ?? brief.claims) ? (input?.claims ?? brief.claims) : []
  const sourceIds = new Set<string>()
  const canonicalUrls = new Set<string>()
  for (const source of sources) {
    const id = String(source?.id || '')
    const url = String(source?.url || '')
    const canonicalUrl = String(source?.canonicalUrl || url)
    if (!id || !url) throw new ApiError('source.id and source.url are required', 400, 'INVALID_SOURCE')
    if (sourceIds.has(id)) throw new ApiError('source ids must be unique within a brief', 409, 'DUPLICATE_SOURCE_ID')
    if (canonicalUrls.has(canonicalUrl)) throw new ApiError('source canonical urls must be unique within a brief', 409, 'DUPLICATE_CANONICAL_SOURCE')
    sourceIds.add(id)
    canonicalUrls.add(canonicalUrl)
  }
  const claimIds = new Set<string>()
  for (const claim of claims) {
    const id = String(claim?.id || '')
    if (!id || !String(claim?.text || '')) throw new ApiError('claim.id and claim.text are required', 400, 'INVALID_CLAIM')
    if (claimIds.has(id)) throw new ApiError('claim ids must be unique within a brief', 409, 'DUPLICATE_CLAIM_ID')
    claimIds.add(id)
    for (const sourceId of Array.isArray(claim?.supportingSourceIds) ? claim.supportingSourceIds : []) {
      if (!sourceIds.has(String(sourceId))) throw new ApiError('claim references a source that is not in the brief', 409, 'UNKNOWN_SUPPORTING_SOURCE')
    }
  }
  return { brief, sources, claims }
}

function mapBriefRow(row: any) {
  if (!row) return null
  return {
    schema: 'creator-content-bundle/v1',
    brief: { ...(row.brief || {}), id: row.id, createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) },
    sources: Array.isArray(row.sources) ? row.sources : [],
    claims: Array.isArray(row.claims) ? row.claims : [],
  }
}

async function saveBriefBundle(id: string, input: any) {
  const { brief, sources, claims } = validateBundle(input)
  if (String(brief.id || id) !== id) throw new ApiError('Path brief id does not match body brief id', 409, 'BRIEF_ID_MISMATCH')
  const existing = await sql`select created_at from creator_private.content_briefs where id = ${id}`
  const timestamp = new Date().toISOString()
  const normalizedSources = sources.map((source: any) => ({
    ...source,
    id: String(source.id),
    briefId: id,
    canonicalUrl: String(source.canonicalUrl || source.url),
    capturedAt: source.capturedAt || timestamp,
  }))
  const normalizedClaims = claims.map((claim: any) => ({
    ...claim,
    id: String(claim.id),
    briefId: id,
    supportingSourceIds: Array.isArray(claim.supportingSourceIds) ? claim.supportingSourceIds.map(String) : [],
  }))
  const logical = {
    schema: 'creator-content-bundle/v1',
    brief: { ...brief, id, createdAt: existing[0]?.created_at ? asIso(existing[0].created_at) : timestamp, updatedAt: timestamp },
    sources: normalizedSources,
    claims: normalizedClaims,
  }
  const hash = await receiptHash(logical)
  const receipt = { schema: 'creator-data-receipt/v1', briefId: id, operation: 'save-bundle', hash, createdAt: timestamp }
  await sql.begin(async (tx) => {
    await tx`
      insert into creator_private.content_briefs (id, brief, sources, claims, receipt, created_at, updated_at)
      values (${id}, ${JSON.stringify(brief)}::jsonb, ${JSON.stringify(normalizedSources)}::jsonb, ${JSON.stringify(normalizedClaims)}::jsonb, ${JSON.stringify(receipt)}::jsonb, coalesce(${existing[0]?.created_at || null}::timestamptz, now()), now())
      on conflict (id) do update set
        brief = excluded.brief,
        sources = excluded.sources,
        claims = excluded.claims,
        receipt = excluded.receipt,
        updated_at = now()
    `
    await tx`
      insert into creator_private.audit_receipts (brief_id, operation, receipt)
      values (${id}, 'save-bundle', ${JSON.stringify(receipt)}::jsonb)
    `
  })
  const rows = await sql`select * from creator_private.content_briefs where id = ${id}`
  return { ...mapBriefRow(rows[0]), receipt }
}

async function getBriefBundle(id: string) {
  const rows = await sql`select * from creator_private.content_briefs where id = ${id}`
  if (!rows.length) return null
  return { ...mapBriefRow(rows[0]), receipt: rows[0].receipt || null }
}

async function health() {
  const counts = await sql`
    select
      (select count(*)::int from creator_private.content_briefs) as briefs,
      (select count(*)::int from creator_private.research_items) as research,
      (select count(*)::int from creator_private.drafts) as drafts,
      (select count(*)::int from creator_private.publications) as publications
  `
  return {
    ok: true,
    provider: 'creator-postgres',
    service: 'creator-data-service',
    apiSchema: 'creator-data-api/v1',
    schemaVersion: 1,
    counts: counts[0] || {},
    // DENO_DEPLOYMENT_ID changes only when the function is redeployed. That is
    // the hosted replacement proof used by certify-hosted.js.
    runtimeInstanceId: Deno.env.get('DENO_DEPLOYMENT_ID') || Deno.env.get('SB_EXECUTION_ID') || 'local',
    executionId: Deno.env.get('SB_EXECUTION_ID') || null,
  }
}

async function route(req: Request) {
  const url = new URL(req.url)
  const path = apiPath(url)

  if (req.method === 'GET' && path === '/health') {
    try { return response(200, await health()) }
    catch { return response(503, { ok: false, provider: 'creator-postgres', service: 'creator-data-service', apiSchema: 'creator-data-api/v1' }) }
  }

  if (!(await authorized(req))) return response(401, { ok: false, code: 'UNAUTHORIZED', error: 'Bearer token required' })

  if (path === '/v1/profile') {
    if (req.method === 'GET') {
      const rows = await sql`select payload, updated_at from creator_private.profile where id = 'default'`
      if (!rows.length) return response(200, { ok: true, data: null })
      return response(200, { ok: true, data: { ...(rows[0].payload || {}), id: 'default', updatedAt: asIso(rows[0].updated_at) } })
    }
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const payload = { identity: body.identity || {}, voice: body.voice || {}, expertise: Array.isArray(body.expertise) ? body.expertise : [] }
      const rows = await sql`
        insert into creator_private.profile (id, payload, updated_at)
        values ('default', ${JSON.stringify(payload)}::jsonb, now())
        on conflict (id) do update set payload = excluded.payload, updated_at = now()
        returning payload, updated_at
      `
      return response(200, { ok: true, data: { ...rows[0].payload, id: 'default', updatedAt: asIso(rows[0].updated_at) } })
    }
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PUT'] })
  }

  if (path === '/v1/research') {
    if (req.method === 'GET') {
      const limit = boundedLimit(url.searchParams.get('limit'), 100, 250)
      const rows = await sql`select payload from creator_private.research_items order by coalesce(published_at, discovered_at) desc limit ${limit}`
      return response(200, { ok: true, data: rows.map((row: any) => row.payload || {}) })
    }
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const items = (Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : [])).slice(0, 100)
      const saved: unknown[] = []
      await sql.begin(async (tx) => {
        for (const item of items) {
          if (!item?.id || !item?.sourceUrl) continue
          await tx`
            insert into creator_private.research_items (id, source_url, payload, published_at, discovered_at, updated_at)
            values (${String(item.id)}, ${String(item.sourceUrl)}, ${JSON.stringify(item)}::jsonb, ${item.publishedAt || null}::timestamptz, now(), now())
            on conflict (id) do update set
              source_url = excluded.source_url,
              payload = excluded.payload,
              published_at = excluded.published_at,
              updated_at = now()
          `
          saved.push(item)
        }
      })
      return response(200, { ok: true, data: saved })
    }
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PUT'] })
  }

  if (path === '/v1/drafts') {
    if (req.method === 'GET') {
      const limit = boundedLimit(url.searchParams.get('limit'), 50, 200)
      const rows = await sql`select payload, created_at, updated_at from creator_private.drafts order by created_at desc limit ${limit}`
      return response(200, { ok: true, data: rows.map((row: any) => ({ ...(row.payload || {}), createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) })) })
    }
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const runId = String(body.runId || body.run_id || '')
      const platform = String(body.platform || '')
      const topic = String(body.topic || '')
      const content = String(body.content || '')
      const version = Math.max(1, Number(body.version || 1))
      if (!runId || !platform || !topic || !content) throw new ApiError('runId, platform, topic and content are required', 400, 'INVALID_DRAFT')
      const payload = { runId, platform, topic, content, status: String(body.status || 'draft'), version, runReceipt: body.runReceipt || body.run_receipt || null, approvalReceipt: body.approvalReceipt || body.approval_receipt || null }
      const rows = await sql`
        insert into creator_private.drafts (run_id, platform, version, payload, created_at, updated_at)
        values (${runId}, ${platform}, ${version}, ${JSON.stringify(payload)}::jsonb, now(), now())
        on conflict (run_id, platform, version) do update set payload = excluded.payload, updated_at = now()
        returning payload, created_at, updated_at
      `
      return response(200, { ok: true, data: { ...rows[0].payload, createdAt: asIso(rows[0].created_at), updatedAt: asIso(rows[0].updated_at) } })
    }
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PUT'] })
  }

  if (path === '/v1/publications') {
    if (req.method === 'GET') {
      const limit = boundedLimit(url.searchParams.get('limit'), 50, 200)
      const rows = await sql`select id, payload, published_at from creator_private.publications order by published_at desc, id desc limit ${limit}`
      return response(200, { ok: true, data: rows.map((row: any) => ({ id: Number(row.id), ...(row.payload || {}), publishedAt: asIso(row.published_at) })) })
    }
    if (req.method === 'POST') {
      const body = await readJson(req)
      const runId = String(body.runId || '')
      const platform = String(body.platform || '')
      const draftHash = String(body.draftHash || '')
      if (!runId || !platform || !draftHash) throw new ApiError('runId, platform and draftHash are required', 400, 'INVALID_PUBLICATION')
      const publishedAt = body.publishedAt || new Date().toISOString()
      const payload = { runId, platform, externalId: body.externalId || body.postId || null, draftHash, receipt: body.receipt || body }
      const rows = await sql`
        insert into creator_private.publications (run_id, platform, draft_hash, payload, published_at)
        values (${runId}, ${platform}, ${draftHash}, ${JSON.stringify(payload)}::jsonb, ${publishedAt}::timestamptz)
        returning id, payload, published_at
      `
      return response(201, { ok: true, data: { id: Number(rows[0].id), ...rows[0].payload, publishedAt: asIso(rows[0].published_at) } })
    }
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'POST'] })
  }

  if (req.method === 'GET' && path === '/v1/briefs') {
    const limit = boundedLimit(url.searchParams.get('limit'), 50, 200)
    const rows = await sql`select id, brief, created_at, updated_at from creator_private.content_briefs order by updated_at desc limit ${limit}`
    return response(200, { ok: true, data: rows.map((row: any) => ({ ...(row.brief || {}), id: row.id, createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) })) })
  }

  const match = path.match(/^\/v1\/briefs\/([^/]+)$/)
  if (match) {
    const id = decodeURIComponent(match[1])
    if (req.method === 'GET') {
      const bundle = await getBriefBundle(id)
      if (!bundle) return response(404, { ok: false, code: 'NOT_FOUND', error: 'Content Brief not found' })
      return response(200, { ok: true, data: { schema: bundle.schema, brief: bundle.brief, sources: bundle.sources, claims: bundle.claims }, receipt: bundle.receipt })
    }
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const saved = await saveBriefBundle(id, body?.brief ? body : { ...body, id })
      return response(200, { ok: true, data: { schema: saved.schema, brief: saved.brief, sources: saved.sources, claims: saved.claims }, receipt: saved.receipt })
    }
    return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PUT'] })
  }

  return response(404, { ok: false, code: 'NOT_FOUND', error: 'Route not found' })
}

Deno.serve(async (req: Request) => {
  try {
    if (!DATABASE_URL) return response(503, { ok: false, code: 'DATABASE_NOT_CONFIGURED', error: 'Database connection is unavailable' })
    return await route(req)
  } catch (error) {
    if (error instanceof ApiError) return response(error.status, { ok: false, code: error.code, error: error.message, details: error.details || null })
    console.error('creator-data request failed', error instanceof Error ? error.message : String(error))
    return response(500, { ok: false, code: 'INTERNAL_ERROR', error: 'Internal error' })
  }
})
