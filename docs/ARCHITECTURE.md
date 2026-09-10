# Architecture

## Design decision

The source tutorial places business logic directly inside n8n HTTP nodes. This project keeps n8n as a scheduler/orchestrator and moves product logic into typed application code. That makes the system testable, versioned and usable from both the dashboard and automation.

## Components

### Next.js application
Owns the marketing site, private studio, authentication, orchestration endpoints, review action and provider adapters. The UI works in `DEMO_MODE=true` so the product can be evaluated without external accounts.

### Content generation
`lib/ai.ts` talks to an OpenAI-compatible chat-completions endpoint. No model ID is hard-coded; `LLM_MODEL` is environment configuration so a deployment can switch providers/models without code changes.

### Orshot adapter
`lib/orshot.ts` is the only module that knows Orshot API contracts. It supports AI presenter generation, async Studio rendering, render job status, social publishing, analytics and best-time insights. This boundary allows a future Remotion/FFmpeg or different AI-video provider without rewriting the product.

### PostgreSQL
Stores channel settings, content ideas/scripts, async render state, social posts and analytics snapshots. Demo mode remains usable without a database.

### Worker
Video renders are not treated as ordinary HTTP requests. `worker/index.ts` reconciles queued/processing jobs against Orshot and persists terminal URLs/errors.

### n8n
The recommended workflow only schedules and starts a content run. The original-style workflow is also included for teams that want provider calls directly in n8n.

## Approval modes
`autoPublish=false` is the safe default. `autoPublish=true` is intended only after a channel has been tested.

## Production hardening path
This MVP intentionally uses one workspace credential pair. A public multi-tenant SaaS should replace it with an identity provider, encrypt provider credentials per workspace, add billing/quotas, use a durable queue, introduce webhook signatures, and apply platform-specific moderation/approval policies.
