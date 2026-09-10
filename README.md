# Faceless Content Creator

A production-oriented faceless short-form content operating system. It expands the small Orshot + n8n demo into a working application that can generate ideas/scripts, create AI-presenter video, render branded vertical shorts asynchronously, hold them for approval or publish automatically, and pull social analytics back into the product.

## What is implemented

- Premium responsive marketing site and interactive creator dashboard
- Demo mode that works without external API keys
- Password/session protection for non-demo deployments
- OpenAI-compatible LLM adapter for topic, hook, script, caption and hashtag generation
- Orshot `/v1/ai/video` presenter generation compatible with the source workflow
- Orshot async `/v1/studio/render` integration for long-running video jobs
- Render status polling and a background reconciliation worker
- Orshot `/v1/social/publish` integration for immediate or scheduled publishing
- Orshot social analytics + best-time insights integration
- PostgreSQL schema for channels, content, render jobs, social posts and analytics snapshots
- Importable n8n production workflow plus an original-gist-compatible workflow
- Docker deployment, health endpoint, CI, type checking, unit tests and smoke test

## Run it now — no API keys required

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. `DEMO_MODE=true` is the default, so the landing page, studio, content run, render lifecycle, approval action and analytics all work without paid services.

## Turn on the real pipeline

Set `DEMO_MODE=false` and configure the values in `.env.example`, apply `sql/schema.sql`, and run the worker on a long-running Node service.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run smoke
```

See `docs/ARCHITECTURE.md` and `docs/PRODUCTION_CHECKLIST.md` for the production boundary and external-account steps.