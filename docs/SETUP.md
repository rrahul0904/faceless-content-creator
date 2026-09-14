# Setup

## Deterministic local engine

The local template/render experience requires no hosted rendering API and no `.env` file.

```bash
git clone https://github.com/rrahul0904/faceless-content-creator.git
cd faceless-content-creator
docker compose up --build
```

Open:

- `http://localhost:3000` — creator workspace
- `http://localhost:3000/studio` — reusable template Studio

The container installs FFmpeg, ffprobe, eSpeak NG and DejaVu fonts, initializes SQLite automatically, and persists the database plus rendered/uploaded media in the Docker data volume.

## Local data

```text
data/
├── faceless.db
├── uploads/
├── renders/
└── work/
```

`faceless.db` stores workspaces, channels, templates and versions, brand assets, content, render jobs, social-account metadata, publications and settings. `uploads/` contains locally ingested presenter/B-roll/audio assets, `renders/` contains generated MP4s, and `work/` contains temporary media artifacts.

## Native development

Install:

- Node.js 22+
- FFmpeg and ffprobe
- eSpeak NG
- DejaVu fonts

Then run:

```bash
npm install
mkdir -p data/uploads data/renders data/work
npx prisma generate
npx prisma db push
npm run dev
```

No database connection string is required in local mode. Prisma uses `file:../data/faceless.db` from `prisma/schema.prisma`.

## Template engine

Seed the built-in template gallery by opening Studio or calling:

```bash
curl -X POST http://localhost:3000/api/v1/templates/bootstrap
```

A parameterized render can then be submitted to either `/api/v1/templates/:id/render` or the stable `/api/v1/studio/render` API. Render state is polled from `/api/v1/render-jobs/:id`; cancellation is available at `/api/v1/render-jobs/:id/cancel`.

Queued cancellations are immediate. Running cancellations are cooperative: the current media operation may finish, but its output is discarded and the job persists as `CANCELLED`.

## Optional remote script model

The deterministic script writer works without credentials. An OpenAI-compatible model can optionally be configured with:

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
```

These settings affect script generation only.

## Optional AI presenter / GPU service

The deterministic faceless renderer does not need a GPU. AI talking-photo/presenter generation is a separate service under `services/avatar-worker/`.

For a CUDA-capable host, use the GPU topology in:

```text
docker-compose.gpu.yml
```

The web/worker process talks to the presenter service through `AVATAR_SERVICE_URL`; inside the supplied Compose topology the default is `http://avatar-worker:8081`.

Do not treat successful CPU CI as proof that a CUDA/MuseTalk deployment is production-certified. The GPU image still needs verification on the actual target GPU infrastructure before commercial rollout.

## Social credentials and publishing

YouTube, Instagram and TikTok require their own platform authorization. Local rendering/export does not need those credentials.

When platform tokens are persisted, configure a strong server-side secret:

```text
SOCIAL_TOKEN_KEY
```

`APP_SECRET` is accepted as a fallback. A secret must be at least 16 characters; the application refuses to persist social access/refresh tokens without it. Tokens are encrypted using AES-256-GCM before database storage.

The repository contains direct publisher workers and durable publication scheduling, but a hosted SaaS still needs customer-facing OAuth connection/callback flows and registered platform applications.

## n8n

n8n is optional. `workflows/n8n/faceless-content-creator.json` automates this application's APIs rather than calling Orshot. The product does not require n8n to render.

## Verification

The GitHub Actions CI pipeline installs the local media stack, audits production dependencies, initializes Prisma/SQLite, runs lint and strict TypeScript, builds Next.js, renders a real MP4 through the worker, builds/boots the Docker image with zero required environment variables, exercises the live HTTP template-render path, range-streams the generated MP4, and verifies the render-cancellation endpoint contract.
