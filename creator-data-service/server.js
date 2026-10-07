'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const { createCreatorStore } = require('./store');

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { status: 413, code: 'BODY_TOO_LARGE' });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid json body'), { status: 400, code: 'INVALID_JSON' }); }
}

function authenticated(req) {
  const expected = process.env.CREATOR_DATA_TOKEN || '';
  if (!expected) return process.env.NODE_ENV === 'test' || process.env.CREATOR_DATA_ALLOW_UNAUTHENTICATED === '1';
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${expected}`;
}

function buildServer(options = {}) {
  const store = options.store || createCreatorStore(options);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { ...store.health(), service: 'creator-data-service', apiSchema: 'creator-data-api/v1' });
      }
      if (!authenticated(req)) return send(res, 401, { ok: false, code: 'UNAUTHORIZED', error: 'Bearer token required' });

      if (req.method === 'GET' && url.pathname === '/v1/briefs') {
        const limit = Number(url.searchParams.get('limit') || 50);
        return send(res, 200, { ok: true, data: store.listBriefs(limit) });
      }

      const match = url.pathname.match(/^\/v1\/briefs\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (req.method === 'GET') {
          const bundle = store.getBundle(id);
          return bundle ? send(res, 200, { ok: true, data: bundle, receipt: store.latestReceipt(id) }) : send(res, 404, { ok: false, code: 'NOT_FOUND', error: 'Content Brief not found' });
        }
        if (req.method === 'PUT') {
          const body = await readJson(req);
          const bodyId = String(body?.brief?.id || body?.id || '');
          if (bodyId && bodyId !== id) return send(res, 409, { ok: false, code: 'BRIEF_ID_MISMATCH', error: 'Path brief id does not match body brief id' });
          const saved = store.saveBundle(body?.brief ? body : { ...body, id });
          return send(res, 200, { ok: true, data: { schema: saved.schema, brief: saved.brief, sources: saved.sources, claims: saved.claims }, receipt: saved.receipt });
        }
      }

      return send(res, 404, { ok: false, code: 'NOT_FOUND', error: 'Route not found' });
    } catch (error) {
      const status = Number(error?.status || 500);
      return send(res, status, { ok: false, code: error?.code || 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' });
    }
  });
  return { server, store };
}

if (require.main === module) {
  const { server, store } = buildServer();
  const port = Math.max(1, Number(process.env.PORT || 8787));
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    process.stdout.write(JSON.stringify({ event: 'creator-data-service.ready', host, port, provider: store.health().provider }) + '\n');
  });
  const shutdown = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { buildServer, readJson, authenticated };
