# Slice A Verification — Content Brief + Creator-owned durability

Status: **code-certified; hosted durability pending**.

Slice A is not complete merely because domain tests pass. It is complete only when the Content Brief, sources, claims and provenance survive a real hosted service replacement on the same durable volume and the Creator Console can reconnect to that service.

## Product boundary

```text
Creator Console
      |
      | HTTPS + bearer token
      v
Creator Data Service
      |
      v
SQLite durable volume
```

Supabase is not a runtime requirement for the reset branch. Hosting providers remain interchangeable infrastructure behind the Creator Data Service contract.

## Code-level proof already obtained

Exact certified SHA before the current documentation-only hosting update:

`d34d3ecdece711675c2ae326c3381c07e6e687df`

GitHub Actions CI run `37667150481` / #553: **SUCCESS**.

The exact-SHA run proves:

- Creator Console domain contracts;
- factual claims require evidence-capable sources;
- reference/style sources cannot silently substantiate facts;
- unresolved community sources remain non-authoritative;
- first-person experience requires author-owned evidence;
- creator opinion may remain opinion without being promoted to fact;
- deterministic Content Brief receipts;
- Creator Data Service HTTP contract;
- bearer-token fail-closed behavior;
- SQLite WAL + foreign keys + transactional brief bundle writes;
- close/reopen persistence;
- cross-brief source/claim isolation;
- bundle rollback on invalid writes;
- source passage/timestamp provenance persistence;
- Docker image build;
- named-volume destroy/recreate recovery in CI;
- runtime instance identity changes after service replacement;
- same-runtime recovery is rejected;
- SQLite integrity checks;
- verified backup creation with SHA-256 receipt;
- portable `prepare -> replace runtime -> recover` hosted-certification workflow;
- parent application dependency audit, lint, typecheck and build;
- parent Docker/API acceptance and fail-closed hosted authentication.

## Creator Console hosted preview proof

The latest preview whose Creator Console runtime changed is READY and truthfully reports:

- `provider=creator-data-service`;
- `configured=false`;
- `connected=false`;
- `mode=browser-fallback`;
- all six Content Brief evidence self-tests passing.

This is correct. Environment variables alone must never mark storage durable.

## Remaining hosted certification

The remaining gate is infrastructure proof, not application design.

Required sequence:

1. deploy `creator-data-service` to an approved host with persistent `/data`;
2. expose it only through HTTPS;
3. configure a strong server-side `CREATOR_DATA_TOKEN`;
4. run `certify:hosted:prepare` and retain the emitted `briefId` + `runtimeInstanceId`;
5. configure the Creator Console preview with `CREATOR_DATA_URL` + `CREATOR_DATA_TOKEN`;
6. verify `/api/storage-health` reports `provider=creator-data-service`, `configured=true`, `connected=true`;
7. replace/restart the data-service runtime without deleting the volume;
8. run `certify:hosted:recover` with the previous runtime instance;
9. require a different runtime instance plus preserved brief/source/claim IDs and source passage/timestamp provenance;
10. create and retain a verified hosted backup receipt;
11. rerun the Creator Console brief self-test with storage connected;
12. attach exact host deployment/image + Vercel deployment receipts;
13. only then mark Slice A PASS and begin Slice B implementation.

## Hosting decision as of 2026-10-08

The detailed provider-neutral comparison lives in `creator-data-service/HOSTING.md`.

Current operational order of preference:

1. an existing approved VPS/VM, if available;
2. Fly.io tiny Machine + small persistent volume for the lowest clearly documented new-host cost;
3. Railway if the connected workspace can use an acceptable plan without an unapproved billing change;
4. Render paid service + persistent disk.

No provider-specific API is allowed to leak into the Creator Console storage contract.

## Merge rule

PR #20 remains draft/unmerged until the hosted restart/recovery sequence above produces an evidence receipt.
