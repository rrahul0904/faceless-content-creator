# Setup

## Recommended: Docker Compose

The default application requires no API keys and no `.env` file.

```bash
git clone https://github.com/rrahul0904/faceless-content-creator.git
cd faceless-content-creator
docker compose up --build
```

Open `http://localhost:3000`.

The container installs FFmpeg, ffprobe, eSpeak NG and DejaVu fonts, initializes the SQLite database automatically, and persists the database plus rendered media in the `faceless_data` Docker volume.

## What is created automatically

```text
data/
├── faceless.db
├── renders/
└── work/
```

`faceless.db` stores channels, content, render jobs, social-account metadata, publications and settings. `renders/` contains generated MP4s. `work/` contains temporary audio/caption artifacts for render jobs.

## Native development

If you do not want Docker, install:

- Node.js 22+
- FFmpeg and ffprobe
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

No database connection string is required. Prisma uses `file:../data/faceless.db` from `prisma/schema.prisma`.

## Optional remote script model

The default deterministic script engine works without credentials. If you want to use an OpenAI-compatible model, you may optionally configure:

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
```

These variables affect script generation only. They are not needed to render video.

## Renderer behavior

A render request creates a `RenderJob` row in SQLite and starts `worker/render-job.mjs` as a detached local worker. The worker:

1. generates a WAV narration using eSpeak NG;
2. measures narration length using ffprobe;
3. creates timed SRT captions;
4. renders a 1080×1920 H.264/AAC MP4 with FFmpeg;
5. updates the render job in SQLite;
6. moves correlated persisted content into `REVIEW`.

Rendered videos are served by `/api/assets/:filename`.

## Social accounts

YouTube, Instagram and TikTok require their own OAuth authorization. Those credentials are intentionally separate from the local renderer and are not required to create or export videos.

The database already includes a `SocialAccount` model so native platform integrations can be connected without reintroducing a rendering vendor.

## n8n

n8n is optional. Import `workflows/n8n/faceless-content-creator.json` when you want scheduled automation. The workflow calls this application's `/api/script` and `/api/render` endpoints rather than calling Orshot directly.
