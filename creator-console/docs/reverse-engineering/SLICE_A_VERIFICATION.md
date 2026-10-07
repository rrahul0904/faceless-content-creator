# Slice A Verification — Content Brief + Claim/Evidence Persistence

Status: **implementation in progress; durable runtime certification pending**.

## What is implemented

- `ContentBrief` domain model and claim-level evidence gate.
- Evidence-classified sources and fail-closed factual-claim rules.
- Deterministic domain receipts for the evidence evaluation path.
- Creator-owned `creator-data-service` using Node SQLite with WAL, foreign keys and transactional bundle saves.
- Source-locator persistence for transcript/media provenance (`sourceLocator` with timestamp/passage metadata).
- Bearer-authenticated HTTP API for durable Content Brief bundle reads/writes.
- Creator Console adapter using `CREATOR_DATA_API_URL` + `CREATOR_DATA_API_TOKEN`.
- Capability-level storage reporting so brief persistence does not falsely imply research/draft/profile/publication persistence.
- Docker + Railway service definition for running the data service on a persistent volume.

## Tests required by CI

The repository CI now runs both:

1. `creator-console` contract tests; and
2. `creator-data-service` tests covering:
   - close/reopen durability;
   - source ID / claim ID preservation;
   - transcript timestamp/source locator preservation;
   - transaction rollback on a failed bundle update;
   - bearer-auth HTTP behavior;
   - HTTP save/reload round-trip.

## Runtime gate still outstanding

Slice A is not PASS until an actual persistent service is connected to the Vercel preview and the following hosted UAT succeeds:

1. deploy `creator-data-service` with a persistent `/data` volume;
2. configure a strong `CREATOR_DATA_TOKEN` server-side;
3. set Creator Console preview variables `CREATOR_DATA_API_URL` and `CREATOR_DATA_API_TOKEN`;
4. verify `/api/storage-health` reports `provider=creator-data-api`, `connected=true`, `capabilities.briefs=true`;
5. save one real Content Brief bundle through Creator Console;
6. reload the same brief ID and verify source/claim identity;
7. restart/redeploy the data service and prove the same brief survives;
8. exercise a failed update and verify the previous bundle remains intact;
9. run hosted `/api/brief-selftest` again;
10. attach exact Git SHA, CI run, Vercel deployment and data-service deployment receipts.

## Non-workaround rule

Do not use Supabase or another product database merely to satisfy Slice A. Do not treat browser `localStorage` as durable production persistence. The target is the Creator-owned data-service contract; SQLite is the v1 engine and can later be replaced by PostgreSQL behind the same API.
