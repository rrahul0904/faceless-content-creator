# Architecture

## Goal

Faceless Content Creator turns a content idea into a narrated, captioned vertical MP4 while keeping the default system self-contained. Rendering, persistence and job state work without a hosted media API or database service.

## Components

- **Next.js web app** — creation studio, operator UI and API surface.
- **Content service** — deterministic short-form script generation by default, with an optional OpenAI-compatible model adapter.
- **SQLite + Prisma** — channels, content items, render jobs, social accounts, publications and settings.
- **Local render queue** — creates durable render jobs and starts detached workers.
- **eSpeak NG** — bundled local narration provider.
- **FFmpeg / ffprobe** — timing, subtitle burn-in, video composition and H.264/AAC encoding.
- **Local asset endpoint** — streams completed MP4 files from `data/renders`.
- **n8n workflow** — optional scheduled client of the application API; not part of the required runtime.
- **CI** — validates dependencies, schema, lint, TypeScript, production build and a real local MP4 render.

## Default production flow

```text
Idea
  ↓
Script package
  ↓
POST /api/render
  ↓
SQLite RenderJob = QUEUED
  ↓
Detached local worker
  ↓
eSpeak NG narration
  ↓
ffprobe duration
  ↓
Timed SRT captions
  ↓
FFmpeg 1080x1920 MP4
  ↓
SQLite RenderJob = SUCCEEDED
  ↓
GET /api/assets/:filename
  ↓
Review / download / export
```

## Content lifecycle

`IDEA -> SCRIPTED -> RENDERING -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED`

`FAILED` is available for failed render or publishing stages. Rendering itself can reach `REVIEW` without any third-party account.

## Render-job durability

Each render request is stored before the worker starts. `RenderJob.input` holds the normalized render specification, and `RenderJob.outputFile`, `videoUrl`, timestamps and error state record the outcome.

The detached worker is intentionally separate from the HTTP request so the client can poll job state rather than holding a long request open. This deployment model assumes a persistent Node process, which is why Docker/self-hosting is the default for the local renderer.

## Storage

```text
data/
├── faceless.db
├── renders/
│   └── <render-job-id>.mp4
└── work/
    └── <render-job-id>/
        ├── voice.wav
        ├── hook.txt
        └── captions.srt
```

The whole directory is mounted as one persistent Docker volume. No external database URL is required.

## Social publishing boundary

Generating a finished video is fully local. Direct social publishing is intentionally treated as a separate adapter boundary because YouTube, Instagram and TikTok require OAuth authorization and platform-specific APIs.

The application stores social connection metadata in `SocialAccount`, but does not route publishing through Orshot or another media proxy. A native connector can later write encrypted OAuth tokens to local settings while keeping the renderer unchanged.

## Reliability rules

- Persist a render job before execution.
- Never require a renderer API key for the default path.
- Keep generated media under a dedicated persistent data directory.
- Reject path traversal in the local asset endpoint.
- Keep social publishing separate from rendering.
- Do not report a social post as published unless a native platform API confirms it.
- Verify the renderer in CI by producing a real MP4.

## Deployment model

The zero-config renderer is designed for a persistent Docker host, VM, Railway-style container service or similar environment with durable disk. Stateless serverless deployments such as a plain Vercel Function are not the primary execution environment for local FFmpeg workers and SQLite persistence.
