# Creator Console Slice A Verification

Status: **implementation verified except hosted durable deployment**.

## Scope

Slice A is the persistent `ContentBrief` + source + claim/evidence boundary. The original implementation assumed Supabase/PostgREST. That infrastructure dependency has been removed from the target architecture.

The target persistence boundary is now a Creator-owned service:

`Creator Console -> Creator Data API -> durable local database`

The first implementation uses Node 22 `node:sqlite` with a persistent filesystem. The API contract is provider-neutral so PostgreSQL or another engine can replace SQLite later without changing Creator Console.

## Verified domain behavior

Hosted `/api/brief-selftest` already certifies:

- official factual evidence can become evidence-ready;
- style/reference posts cannot support factual claims;
- unresolved community shortlinks cannot support factual claims;
- author-experience claims require author-owned evidence;
- creator opinion can stand alone when correctly typed;
- deterministic receipt replay.

## Creator Data Service implementation

Repository path: `creator-data-service/`

Implemented:

- dependency-light Node HTTP API;
- SQLite durable store;
- WAL mode + foreign keys + full synchronous writes;
- transactional Content Brief bundle writes;
- brief/source/claim identity preservation;
- source locator persistence for timestamp/passage provenance;
- deterministic `creator-data-receipt/v1` audit receipts;
- bearer-token protection for data endpoints;
- restart recovery via the same database file;
- rollback on failed bundle writes.

CI runs `creator-data-service` persistence tests independently from Creator Console tests.

## Current hosting blocker

Railway was evaluated as one possible persistent-volume host. The connected Railway workspace currently rejects new project creation because its trial is expired and requires a plan selection. No billing change was made automatically.

Railway is therefore **not** a product dependency. Any approved host that provides a durable filesystem or block volume is acceptable.

The remaining Slice A blocker is:

> deploy the Creator Data Service on an approved host with persistent disk, configure `CREATOR_DATA_URL` + `CREATOR_DATA_TOKEN`, and run hosted save/reload/restart recovery UAT.

## Required hosted certification

1. deploy Creator Data Service with a persistent volume;
2. configure a secret bearer token;
3. point Creator Console preview to `CREATOR_DATA_URL` and `CREATOR_DATA_TOKEN`;
4. save one real Content Brief bundle;
5. reload the same brief and prove source/claim identity preservation;
6. restart/redeploy the data service;
7. reload the same brief again;
8. exercise failed write / rollback recovery;
9. verify source passage/timestamp provenance survives;
10. run Creator Console `/api/brief-selftest` again;
11. attach exact code SHA + service deployment + UI preview receipts;
12. only then mark Slice A PASS and begin Slice B implementation.

## Explicit non-claims

- browser `localStorage` is not durable certification;
- an ephemeral Vercel filesystem is not durable certification;
- Supabase is not required;
- Railway is not required;
- the current Creator Data Service does not yet persist drafts/profile/publications; those capabilities remain explicit follow-on work and are not part of Slice A certification.
