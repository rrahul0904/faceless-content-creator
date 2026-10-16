# Faceless Content Creator

Faceless Content Creator is an independently implemented programmable creative engine and short-form content studio. It started from a clean-room reverse engineering of the public Orshot + n8n workflow, then evolved beyond a vendor wrapper into an owned template, rendering, media, presenter and social-publishing stack.

The goal is a sellable SaaS where a customer can design a reusable visual template once, expose selected properties as parameters, generate videos from content data, review them, schedule/publish them, and learn from performance.

## Current milestone

The current engine milestone implements the programmable-media layer plus the first hosted SaaS control-plane boundaries:

- versioned multi-page visual templates
- parameterizable text, image, video, shape, container and waveform layers
- flattened render modifications such as `hook`, `hero_image`, `accent.fill`, and `hook.style.fontSize`
- responsive Smart Resize and saved layout variants
- declarative motion/timing compilation and word-anchored semantic visual timing
- reference-video metadata, hard-cut and editing-rhythm analysis with semantic-event-to-scene binding
- browser-based template Studio using the same JSON document consumed by final rendering
- async durable render jobs, history and cancellation
- FFmpeg composition with narration, subtitles, media layers, multi-page scenes and audio tracks
- workspace-scoped brand assets and workspace-owned media uploads
- shared media streaming with byte-range video playback and tenant ownership checks
- workspace API-key authentication with fail-closed hosted mode
- workspace membership/role control plane with last-owner protection
- per-plan render, AI-video, social-publish, storage, member and metered-request limits
- usage accounting and credit-ledger foundation
- separate AI-presenter service boundary and GPU Docker topology
- encrypted social credential storage boundary
- durable scheduled publication records and YouTube / Instagram / TikTok publisher adapters

The original hard-coded local renderer is retained only as a compatibility/smoke path while the generic template engine becomes the only renderer.

## Engine flow

```text
Idea / content data
        ↓
Template + dynamic modifications
        ↓
Template compiler
  ├─ parameter replacement
  ├─ responsive layout
  ├─ semantic/motion timeline
  └─ media/audio/subtitle plan
        ↓
Workspace plan / quota gate
        ↓
Durable render job
        ↓
CPU render worker ───────────────┐
        ↓                         │
FFmpeg composition               │
        ↓                         │
MP4 / preview / export            │
                                  │
Optional AI presenter             │
image + script → GPU worker ──────┘
        ↓
Review / schedule / publish
```

## Zero-config local engine

For local engine development, no hosted rendering vendor is required:

```bash
git clone https://github.com/rrahul0904/faceless-content-creator.git
cd faceless-content-creator
docker compose up --build
```

Open `http://localhost:3000` for the creator workspace and `http://localhost:3000/studio` for the template Studio.

The local deterministic render path does not require:

```text
ORSHOT_API_KEY
ORSHOT_TEMPLATE_ID
ORSHOT_PRESENTER_IMAGE
ORSHOT_VOICE_ID
DATABASE_URL
APP_BASE_URL
WEBHOOK_SECRET
```

Local mode uses SQLite, FFmpeg, eSpeak NG and repository-owned templates. Optional external AI providers and social networks naturally require their own authorization when enabled.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/v1/templates` | List/create reusable visual templates |
| `GET/PATCH /api/v1/templates/:id` | Read/version a template |
| `POST /api/v1/templates/bootstrap` | Seed built-in templates |
| `POST /api/v1/templates/:id/render` | Queue a parameterized template render |
| `POST /api/v1/studio/render` | Stable Studio-style `templateId + modifications` render contract |
| `GET /api/v1/render-jobs` | Render history |
| `GET /api/v1/render-jobs/:id` | Poll a render job |
| `POST /api/v1/render-jobs/:id/cancel` | Cancel queued/running renders |
| `GET/POST /api/v1/brand-assets` | Workspace brand assets |
| `GET/PATCH/DELETE /api/v1/brand-assets/:id` | Manage a brand asset |
| `POST /api/v1/ai/video` | Queue an AI-presenter job |
| `POST /api/v1/semantic-timeline/compile` | Compile word-anchored semantic visual timing |
| `POST /api/v1/reference-video/analyze` | Analyze workspace-owned reference-video scene structure |
| `GET /api/v1/workspace` | Workspace, billing and usage summary |
| `GET /api/v1/usage` | Workspace usage summary |
| `GET /api/v1/limits` | Current plan limits, usage and rate-bucket state |
| `GET/POST /api/v1/memberships` | List/create workspace memberships |
| `PATCH/DELETE /api/v1/memberships/:id` | Change roles/remove members with last-owner protection |
| `POST /api/media` | Upload workspace-owned presenter/B-roll/audio media |
| `GET /api/media/:filename` | Stream authorized uploaded media with range support |

Compatibility/content endpoints such as `/api/script`, `/api/render`, `/api/content`, `/api/channels`, `/api/social/*`, and `/api/analytics` remain available while the product UI is consolidated around the v1 engine. Render/publish compatibility paths are subject to the same workspace plan enforcement rather than bypassing the v1 controls.

## Rendering and cancellation

Render jobs persist in SQLite for local mode. A worker atomically claims a queued job before rendering. Cancellation has real state semantics:

- queued jobs move immediately to `CANCELLED` before a worker can claim them;
- running jobs receive `cancelRequested=true`;
- an in-flight media operation may finish, but its output is discarded and the job persists as `CANCELLED` rather than `SUCCEEDED`;
- cancellation of an already-terminal job is idempotent.

This contract is designed so the implementation can move from local detached workers to a cloud render queue without changing client APIs.

## SaaS controls

Hosted API-key mode fails closed when a valid workspace key is absent. Workspaces carry plans and usage, API keys resolve directly to a workspace, memberships are tenant-scoped, and the last owner cannot be removed or demoted.

Plan controls cover monthly render jobs, AI-video jobs, social publishes, uploaded storage, workspace member count and a persisted per-minute metered-request budget. Media uploads are workspace-owned and storage-metered; reference-video analysis applies the same ownership boundary. See [`docs/SAAS_LIMITS.md`](docs/SAAS_LIMITS.md) for defaults, environment overrides and certification details.

These are operator/control-plane APIs today. Customer-facing sign-in/session identity, invitations and per-user authorization are intentionally kept as the next identity slice rather than being simulated by API keys.

## AI presenter

The presenter capability is isolated from the Next.js process. `POST /api/v1/ai/video` creates the same kind of durable async job as deterministic rendering. A separate GPU service is defined under:

```text
services/avatar-worker/
docker-compose.gpu.yml
```

The service boundary is designed for neural TTS + talking-photo/lip-sync inference. GPU/model deployment is optional and is not required for deterministic faceless rendering.

## Social publishing

The engine contains durable publication scheduling and native publisher adapters for YouTube, Instagram and TikTok. Social credentials are encrypted before persistence when token storage is configured.

A commercial hosted deployment still needs platform OAuth applications and customer-facing **Connect account** flows. The repository does not pretend those platform authorizations can be removed or anonymously generated.

## Verification

CI verifies the real media and SaaS-control paths rather than only compiling code:

1. installs FFmpeg, eSpeak NG and fonts;
2. performs deterministic `npm ci` and audits production dependencies;
3. generates Prisma Client and initializes SQLite;
4. runs ESLint and strict TypeScript;
5. creates a production Next.js build;
6. renders a real MP4 through the worker;
7. builds and boots the Docker image;
8. uploads and analyzes a real synthesized reference MP4;
9. compiles semantic word timing and uses it in a real template render;
10. polls render state and byte-range streams generated MP4 data;
11. verifies render cancellation and workspace isolation contracts;
12. certifies storage accounting/quota rejection, render quota rejection, rate limiting, membership caps and last-owner protection;
13. boots a second container in hosted API-key mode and verifies fail-closed authentication.

CI is branch-concurrent: superseded push/PR runs are cancelled so release evidence always corresponds to the latest head.

## What is deliberately next

The owned engine and first SaaS control-plane layer are in place, but a commercial hosted product still needs external infrastructure and customer-facing productization. Before calling that product complete we still need:

- customer-facing sign-in/session identity, invitations and per-user role authorization
- hosted PostgreSQL instead of single-node SQLite
- object storage/CDN instead of local disk while preserving workspace media ownership
- durable distributed CPU/GPU queues with retries, leases and dead-letter handling
- billing-provider checkout/webhooks and automated plan changes on top of the existing plan/usage/credit controls
- customer-facing OAuth connection flows for social platforms
- analytics ingestion/UI and optimization feedback loop
- production deployment, secrets/observability, backup/restore and browser E2E certification

Those external/productization gates are intentionally kept explicit rather than being hidden behind a “complete” label.

## Documentation

- [`docs/ORSHOT_REVERSE_ENGINEERING.md`](docs/ORSHOT_REVERSE_ENGINEERING.md) — capability map and independent implementation design
- [`docs/SEMANTIC_VIDEO.md`](docs/SEMANTIC_VIDEO.md) — word-anchored semantic timing contract
- [`docs/REFERENCE_VIDEO_ANALYSIS.md`](docs/REFERENCE_VIDEO_ANALYSIS.md) — reference-video analysis and scene binding
- [`docs/SAAS_LIMITS.md`](docs/SAAS_LIMITS.md) — plans, quotas, membership controls and media tenant boundary
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — local/runtime architecture
- [`docs/SETUP.md`](docs/SETUP.md) — development setup

## License

MIT
