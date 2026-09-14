# Faceless Content Creator

Faceless Content Creator is an independently implemented programmable creative engine and short-form content studio. It started from a clean-room reverse engineering of the public Orshot + n8n workflow, then evolved beyond a vendor wrapper into an owned template, rendering, media, presenter and social-publishing stack.

The goal is a sellable SaaS where a customer can design a reusable visual template once, expose selected properties as parameters, generate videos from content data, review them, schedule/publish them, and learn from performance.

## Current milestone

The current engine milestone implements the core programmable-media layer:

- versioned multi-page visual templates
- parameterizable text, image, video, shape, container and waveform layers
- flattened render modifications such as `hook`, `hero_image`, `accent.fill`, and `hook.style.fontSize`
- responsive Smart Resize and saved layout variants
- declarative motion/timing compilation
- browser-based template Studio using the same JSON document consumed by final rendering
- async durable render jobs, history and cancellation
- FFmpeg composition with narration, subtitles, media layers, multi-page scenes and audio tracks
- workspace-scoped brand assets
- shared media upload/streaming with byte-range video playback
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
  ├─ motion/timeline
  └─ media/audio/subtitle plan
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

## Orshot-class API surface

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
| `POST /api/media` | Upload presenter/B-roll/audio media |
| `GET /api/media/:filename` | Stream uploaded media with range support |

Compatibility/content endpoints such as `/api/script`, `/api/render`, `/api/content`, `/api/channels`, `/api/social/*`, and `/api/analytics` remain available while the product UI is consolidated around the v1 engine.

## Rendering and cancellation

Render jobs persist in SQLite for local mode. A worker atomically claims a queued job before rendering. Cancellation has real state semantics:

- queued jobs move immediately to `CANCELLED` before a worker can claim them;
- running jobs receive `cancelRequested=true`;
- an in-flight media operation may finish, but its output is discarded and the job persists as `CANCELLED` rather than `SUCCEEDED`;
- cancellation of an already-terminal job is idempotent.

This contract is designed so the implementation can move from local detached workers to a cloud render queue without changing client APIs.

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

CI verifies the real media path rather than only compiling code:

1. installs FFmpeg, eSpeak NG and fonts;
2. installs and audits production dependencies;
3. generates Prisma Client and initializes SQLite;
4. runs ESLint and strict TypeScript;
5. creates a production Next.js build;
6. renders a real MP4 through the worker;
7. builds the Docker image;
8. boots the image with zero required environment variables;
9. calls the live HTTP script/template APIs;
10. polls render state and byte-range streams the generated MP4;
11. verifies the render-cancellation API contract.

CI is branch-concurrent: superseded push/PR runs are cancelled so release evidence always corresponds to the latest head.

## What is deliberately next

This repository now has the creative-engine foundation, but a sellable hosted SaaS still needs a separate productization phase. Before calling the commercial product complete we still need:

- customer authentication and workspace membership/roles
- hosted PostgreSQL instead of single-node SQLite
- object storage/CDN instead of local disk
- durable distributed CPU/GPU queues and retry/dead-letter handling
- subscriptions, plans, credits and usage metering
- customer-facing OAuth connection flows for social platforms
- analytics ingestion/UI and optimization feedback loop
- rate limits, quotas and abuse controls
- production deployment/observability and browser E2E certification

Those are intentionally treated as the next phase rather than being hidden behind a “complete” label.

## Documentation

- [`docs/ORSHOT_REVERSE_ENGINEERING.md`](docs/ORSHOT_REVERSE_ENGINEERING.md) — capability map and independent implementation design
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — local/runtime architecture
- [`docs/SETUP.md`](docs/SETUP.md) — development setup

## License

MIT
