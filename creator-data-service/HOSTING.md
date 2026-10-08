# Creator Data Service — Hosting and Recovery Runbook

This runbook is provider-neutral. The service needs only Docker, durable disk, HTTPS reachability from Creator Console, and a strong bearer token.

## 1. Host requirements

- Docker Engine with Compose v2.
- A persistent disk/volume that is not destroyed when the container is replaced.
- Outbound/inbound HTTPS through a reverse proxy or platform TLS endpoint.
- Node is not required on the host when Docker is used.
- Do not expose port 8787 directly to the public internet over plain HTTP.

## 2. Configure

```bash
cd creator-data-service
cp .env.example .env
```

Generate a strong random `CREATOR_DATA_TOKEN` and place it in `.env`.

The Compose service binds to `127.0.0.1:8787` by default. Put a TLS reverse proxy in front of that loopback endpoint, or use a hosting platform that terminates TLS before forwarding to the container.

## 3. Start

```bash
docker compose up -d --build
```

Verify:

```bash
curl -fsS http://127.0.0.1:8787/health
```

Health includes a non-secret `runtimeInstanceId`. It is generated once per service process and remains stable for that process lifetime. A different value after replacement is used as proof that the service really restarted.

The `creator-data` named volume is the persistence boundary. A normal upgrade replaces the container, not the volume.

## 4. Integrity and backup

Run a live integrity check:

```bash
docker compose exec creator-data npm run integrity
```

Create a verified SQLite snapshot:

```bash
docker compose exec creator-data npm run backup
```

A backup is accepted only when:

1. the source database passes `PRAGMA integrity_check` and foreign-key validation;
2. SQLite creates a consistent snapshot with `VACUUM INTO`;
3. the backup is reopened and passes the same integrity checks;
4. a SHA-256 receipt is emitted.

Backups are written under `/data/backups`, so they remain inside the persistent volume. Copy verified backups to separate storage according to the operator's retention policy; one volume is not a disaster-recovery strategy by itself.

## 5. Connect Creator Console

Set these server-side variables on the Creator Console preview/deployment:

```text
CREATOR_DATA_URL=https://data.example.com
CREATOR_DATA_TOKEN=<same strong token>
```

`CREATOR_DATA_API_URL` and `CREATOR_DATA_API_TOKEN` remain accepted only as migration aliases.

After redeployment, verify:

```text
/api/storage-health
```

Expected result:

```json
{
  "provider": "creator-data-service",
  "configured": true,
  "connected": true
}
```

Durable capability flags must remain false if the service is unreachable even when environment variables are present.

## 6. Hosted Slice-A certification — before restart

From a checkout of this repository with Node 22.13+:

```bash
cd creator-data-service
CREATOR_DATA_URL=https://data.example.com \
CREATOR_DATA_TOKEN='<token>' \
npm run certify:hosted:prepare
```

The prepare phase proves:

- authenticated health succeeds;
- a real Content Brief bundle can be saved and reloaded;
- logical brief/source/claim IDs survive;
- source passage/timestamp provenance survives;
- an intentionally invalid bundle fails;
- the failed update rolls back instead of partially committing;
- the current `runtimeInstanceId` is recorded in the certification receipt.

Record both `briefId` and `runtimeInstanceId` from the emitted receipt.

## 7. Replace/restart the service

Replace or restart the service process/container while preserving the exact same persistent `/data` volume.

With Compose:

```bash
docker compose up -d --build --force-recreate creator-data
```

Do not run `docker compose down -v`; `-v` deletes the persistence boundary.

## 8. Hosted Slice-A certification — after restart

Using the values from the prepare receipt:

```bash
CREATOR_DATA_URL=https://data.example.com \
CREATOR_DATA_TOKEN='<token>' \
CERT_BRIEF_ID='<briefId>' \
CERT_PREVIOUS_INSTANCE_ID='<runtimeInstanceId-from-prepare>' \
npm run certify:hosted:recover
```

The recover phase verifies:

- the current `runtimeInstanceId` exists and is different from the prepare-phase instance;
- the same brief/source/claim identities survived;
- the claim/source relationship survived;
- the source timestamp and passage survived.

Recovery deliberately **fails** if it is run against the same service process. A data reload alone is not accepted as restart certification.

Only after both certification receipts pass should hosted durability be marked PASS.

## 9. Upgrade rule

For every data-service upgrade:

1. run `npm run integrity`;
2. create and retain a verified backup;
3. record the current health `runtimeInstanceId`;
4. deploy the new image without deleting the persistent volume;
5. check `/health` and confirm the runtime instance changed;
6. load at least one known Content Brief;
7. keep the previous image reference until recovery is verified.

## 10. Failure rules

- Never count browser `localStorage` as server durability.
- Never count an ephemeral serverless filesystem as durable storage.
- Never mark durability PASS because configuration variables exist; health must prove connectivity.
- Never mark restart recovery PASS if `runtimeInstanceId` did not change.
- Never destroy the volume during routine container replacement.
- Never restore an unverified backup over the active database.
- Never expose the bearer token in browser-side code or public logs.

## 11. Hosting decision matrix — 2026-10-08

The product remains provider-neutral. These values are operational planning inputs, not dependencies in the Creator Data Service contract.

| Candidate | Persistent-storage fit | Current cost signal | Decision |
|---|---|---|---|
| Railway | Native volume; Free plan documents up to 0.5 GB volume, Hobby up to 5 GB. | Free plan is documented as $0/month after trial with a $1/month phase; Hobby has a $5 minimum usage. The currently connected workspace has an expired trial and requires plan selection before a new persistent deployment can be certified. | VALID HOST, but do not change billing without explicit approval. |
| Fly.io Machines | Native persistent volume + automatic snapshots. | Smallest documented shared CPU machine is about $2.19/month; volumes are $0.15/GB-month; first 10 GB of snapshot storage is free. | CURRENT LOW-COST RECOMMENDATION for this single-user SQLite service, subject to account/billing approval. |
| Render | Persistent disk is supported on paid web/private/background services. | Persistent disk is $0.25/GB-month, plus paid compute. | VALID HOST, but not the lowest-cost documented option for this service. |
| Self-managed VPS/VM | Full disk ownership; run the included Docker Compose stack behind TLS. | Provider-specific. | STRONGEST INFRASTRUCTURE CONTROL; use when an existing VM is available or when operational ownership is preferred over PaaS convenience. |

### Selection rule

Prefer the smallest approved host that satisfies all of these:

1. persistent volume survives container replacement;
2. public HTTPS endpoint can reach only the service API, not the raw filesystem;
3. secrets are server-side only;
4. restart/redeploy can be triggered without deleting the volume;
5. backup artifacts can be copied off-volume;
6. exact deployment/image identity can be recorded for certification.

Do **not** move the Creator Console storage contract into a provider-specific API. A host is interchangeable infrastructure; `Creator Data Service` remains the product-owned persistence boundary.

### Current recommendation

For a brand-new low-traffic deployment, Fly.io currently has the clearest low fixed cost for the required shape: one tiny machine plus one small persistent volume. Railway remains attractive if the existing account can use its Free plan without a billing change. A pre-existing VPS would be preferable to both if one is already available, because it avoids adding another platform account solely for this service.
