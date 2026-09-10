# Architecture

## Goal

Faceless Content Creator turns a content idea into a reviewed, rendered and published vertical short while keeping the rendering and social vendors replaceable.

## Components

- **Next.js web app**: operator dashboard, creation studio and API surface.
- **Content service**: provider-neutral short-form script generation. It works in deterministic demo mode without an LLM key and supports an OpenAI-compatible endpoint through environment variables.
- **PostgreSQL + Prisma**: channels, content items, render state and publications.
- **Orshot adapter**: async Studio rendering, render-job polling and social publishing.
- **n8n workflow**: importable recreation of the reference workflow, upgraded with a real social-draft node and an explicit human-review gate.
- **CI**: typecheck and production build on every push and pull request.

## Content lifecycle

`IDEA -> SCRIPTED -> RENDERING -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED`

`FAILED` is terminal until the operator retries the failed stage.

## Production flow

1. Discover/import an idea.
2. Generate a hook, spoken script and caption.
3. Generate or select presenter/b-roll media.
4. Start an asynchronous Orshot Studio MP4 render.
5. Poll `/v1/studio/render-jobs/:id` or consume an Orshot webhook.
6. Store the returned video URL and move content to `REVIEW`.
7. Operator approves or regenerates.
8. Publish immediately, schedule, or create a draft using Orshot social publishing.
9. Persist platform publication IDs and metrics.
10. Feed performance back into future topic/hook scoring.

## Reliability rules

- Long video renders are asynchronous rather than holding an HTTP request open.
- Vendor API keys remain server-side.
- Social publishing is not enabled automatically for a new channel.
- Publishing requests are designed to be persisted before execution so retries can become idempotent.
- External provider payloads are isolated in adapters rather than spread through UI code.

## Deployment model

The web application can run on Vercel or as the provided standalone Docker image. PostgreSQL can be Supabase, Neon, RDS, Railway or any standard PostgreSQL service. n8n can be Cloud or self-hosted.
