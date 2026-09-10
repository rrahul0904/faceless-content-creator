# Faceless Content Creator

A local-first faceless-content studio that turns an idea into a narrated, captioned 9:16 MP4 without requiring a hosted rendering API, template ID, presenter image, callback URL, webhook secret, or database server.

The project started by reverse-engineering the Orshot + n8n tutorial. The default runtime has now been refactored so Orshot is **not in the critical path**.

## Zero-config quick start

```bash
git clone https://github.com/rrahul0904/faceless-content-creator.git
cd faceless-content-creator
docker compose up --build
```

Open `http://localhost:3000`.

That is enough to create and render a video. No `.env` file is required.

## What the default stack uses

- **Next.js 16** for the product UI and API
- **SQLite + Prisma** at `data/faceless.db`
- **eSpeak NG** for bundled local text-to-speech
- **FFmpeg** for 1080×1920 MP4 composition, audio encoding and burned captions
- **Detached local render jobs** persisted in SQLite
- **Docker Compose** with one application service and one persistent data volume

## What was removed from the required setup

The default application does **not** require any of the following:

```text
ORSHOT_API_KEY
ORSHOT_TEMPLATE_ID
ORSHOT_PRESENTER_IMAGE
ORSHOT_VOICE_ID
DATABASE_URL
APP_BASE_URL
WEBHOOK_SECRET
```

There is no Orshot SDK/adapter in the default runtime and no render-completion webhook.

## Product flow

```text
Niche + idea
    ↓
Hook + script + caption
    ↓
Local text-to-speech
    ↓
Local 9:16 FFmpeg composition
    ↓
Burned captions + narration
    ↓
SQLite render-job state
    ↓
Browser preview
    ↓
Download/export MP4
```

## Development without Docker

Docker is the easiest path because it installs the media dependencies automatically. For native development install:

- Node.js 22+
- FFmpeg / ffprobe
- eSpeak NG
- DejaVu fonts

Then run:

```bash
npm install
mkdir -p data/renders data/work
npx prisma generate
npx prisma db push
npm run dev
```

## Script generation

The built-in deterministic script engine works with no credentials. An OpenAI-compatible endpoint remains an **optional** enhancement through `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`; none is required for rendering.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /api/script` | Generate a short-form script package |
| `POST /api/render` | Queue a local FFmpeg render |
| `GET /api/render/:id` | Read local render status and output URL |
| `GET /api/assets/:filename` | Stream a rendered MP4 from local storage |
| `GET/POST /api/channels` | Manage content channels |
| `GET/POST /api/content` | Manage persisted content |
| `POST /api/content/:id/render` | Render persisted content locally |
| `GET /api/social/accounts` | Read locally stored social connections |
| `GET /api/analytics` | Read analytics persisted in SQLite |
| `GET /api/health` | Service health check |

## Social publishing

Video generation and export are fully local and zero-config. Direct publishing to YouTube, Instagram or TikTok is a separate concern because those platforms require OAuth authorization. This repository no longer proxies publishing through Orshot. Native platform adapters can store connection state in the included `SocialAccount` model instead of using renderer credentials.

Until a native adapter is connected, the product gives you the finished MP4 and caption without pretending a post was published.

## n8n

`workflows/n8n/faceless-content-creator.json` is an optional automation client for **this application API**, not for Orshot. The application itself does not require n8n.

## Verification

GitHub Actions verifies the actual self-hosted path:

1. install FFmpeg, eSpeak NG and fonts;
2. install dependencies and audit production packages;
3. initialize SQLite;
4. lint and typecheck;
5. build Next.js;
6. render a real narrated MP4 as a smoke test.

A successful CI run therefore proves more than compilation: the local media engine produced a real file.

See [`docs/SETUP.md`](docs/SETUP.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT
