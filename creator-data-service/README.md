# Creator Data Service

Creator-owned durable persistence for Creator Console.

This service exists so Creator Console depends on **our storage contract**, not on Supabase, Railway, or any other database vendor API.

## Boundary

```text
Creator Console
      |
      | HTTPS + Bearer token
      v
Creator Data API
      |
      v
SQLite database on durable disk
```

SQLite is the first single-user storage engine. The HTTP contract is intentionally independent from SQLite so the engine can later be replaced by PostgreSQL without changing Creator Console.

## Persisted objects

- Content Briefs
- evidence sources
- claims
- creator profile / voice / expertise
- research inbox
- draft versions
- publication receipts
- deterministic brief save receipts
- source locators such as transcript passages and timestamps

## Runtime requirements

- Node.js 22.13+
- a durable writable directory
- a secret bearer token

Environment variables:

```text
CREATOR_DATA_TOKEN=<strong-random-secret>
CREATOR_DATA_DIR=/data
CREATOR_DATA_BACKUP_DIR=/data/backups
PORT=8787
```

`CREATOR_DATA_TOKEN` is required in normal production operation. Data routes fail closed without the correct bearer token. `/health` is intentionally public and contains no stored content or filesystem path. It includes a non-secret `runtimeInstanceId`, generated once per service process, so restart certification can prove that the runtime actually changed.

## Local development

```bash
cd creator-data-service
CREATOR_DATA_ALLOW_UNAUTHENTICATED=1 npm start
```

The default database is `./data/creator.sqlite` when `CREATOR_DATA_DIR` is not set.

Run certification:

```bash
npm test
```

## Portable Docker deployment

The preferred generic deployment contract is the included Compose file:

```bash
cd creator-data-service
cp .env.example .env
# replace CREATOR_DATA_TOKEN in .env with a strong random secret
docker compose up -d --build
```

Compose uses a stable named volume mounted at `/data` and binds to loopback by default. Put HTTPS/TLS in front of the service before connecting a remote Creator Console deployment.

For the full provider-neutral deployment, recovery, upgrade, and hosted certification procedure, see `HOSTING.md`.

Direct Docker is also supported:

```bash
docker volume create creator-data

docker run -d \
  --name creator-data-service \
  -e CREATOR_DATA_TOKEN='<strong-random-secret>' \
  -p 8787:8787 \
  -v creator-data:/data \
  creator-data-service
```

The volume is the durable boundary. Replacing or restarting the container must not replace that volume.

## Integrity and backup operations

Check the active database:

```bash
npm run integrity
```

Create a verified SQLite snapshot:

```bash
npm run backup
```

Backups are created with SQLite `VACUUM INTO`, reopened, integrity-checked, foreign-key checked, and SHA-256 stamped before a success receipt is returned. By default they are stored under `${CREATOR_DATA_BACKUP_DIR}` or beside the database in `backups/`.

## Hosted durability certification

Before the host restart/replacement:

```bash
CREATOR_DATA_URL=https://data.example.com \
CREATOR_DATA_TOKEN='<token>' \
npm run certify:hosted:prepare
```

The prepare phase saves and reloads a real evidence bundle, proves an intentionally invalid update rolls back atomically, and records the current `runtimeInstanceId`.

After replacing/restarting the service while keeping the same `/data` volume, use both values emitted by prepare:

```bash
CREATOR_DATA_URL=https://data.example.com \
CREATOR_DATA_TOKEN='<token>' \
CERT_BRIEF_ID='<brief-id-from-prepare>' \
CERT_PREVIOUS_INSTANCE_ID='<runtime-instance-id-from-prepare>' \
npm run certify:hosted:recover
```

The recover phase verifies the same brief/source/claim identities plus source timestamp/passage provenance **and** requires the current runtime instance to differ from the prepare-phase instance. Recover fails if no real service replacement occurred.

## Creator Console configuration

Creator Console uses:

```text
CREATOR_DATA_URL=https://<creator-data-service-host>
CREATOR_DATA_TOKEN=<same-secret>
```

`CREATOR_DATA_API_URL` and `CREATOR_DATA_API_TOKEN` are accepted as temporary migration aliases.

When the URL and token are present, Creator Console uses `creator-data-service` for briefs, research, profile, drafts and publication receipts. On the reverse-engineering reset branch, Supabase variables do not configure storage and Supabase is not a runtime dependency.

## API v1

Public:

```text
GET /health
```

Bearer-token protected:

```text
GET  /v1/profile
PUT  /v1/profile
GET  /v1/research
PUT  /v1/research
GET  /v1/drafts
PUT  /v1/drafts
GET  /v1/publications
POST /v1/publications
GET  /v1/briefs
GET  /v1/briefs/:id
PUT  /v1/briefs/:id
```

Content Brief writes are bundle-level transactions: brief + sources + claims either commit together or roll back together.

## Durability settings

The SQLite connection enables:

- WAL journaling
- foreign keys
- `synchronous=FULL`
- a busy timeout
- explicit immediate transactions for Content Brief bundle writes

These settings are aimed at the current single-user Creator Console workload. This is not a claim that the SQLite implementation is appropriate for arbitrary multi-region or high-concurrency workloads.

## Certification rule

A deployment is not considered durable merely because the service starts.

Hosted Slice A certification requires:

1. save a real Content Brief bundle;
2. reload it;
3. prove an invalid bundle rolls back without partial persistence;
4. record the current runtime instance identity;
5. replace/restart the service process/container while keeping the same volume;
6. prove the runtime identity changed;
7. reload the same logical IDs from the same volume;
8. verify source timestamp/passage provenance survived;
9. attach exact code/deployment receipts.
