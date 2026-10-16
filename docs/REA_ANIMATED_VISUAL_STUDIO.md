# REA Capability Absorption: Animated Visual Studio

Status: Phase 2 implementation candidate
Tracker: GitHub issue #31
Canonical branch: `feature/animated-visual-studio`

## 1. Target identity

This work absorbs the public product pattern behind prompt-driven animated LinkedIn visuals into the owned Creator Console. The target capability is not treated as a code clone. The external product is a capability reference; the implementation remains inside our own planning, template, render and publishing control planes.

Publicly observed capability pattern:

1. prompt or structured content input
2. automatic format/story selection
3. saved or per-request brand
4. deterministic visual composition
5. motion applied after the still/story is valid
6. static and animated export
7. API/MCP access for agents and automation

Open donor used for quality/process reference:

- `imMamdouhaboammar/linkedin-animated-infographics`
- license: MIT
- useful patterns: evidence boundary, creative/story separation, still-before-motion gate, feed-scale quality checks, independent final verification

## 2. Clean-room boundary

Allowed inputs:

- public marketing pages and API documentation
- public examples and observable output behavior
- MIT-licensed donor patterns with attribution where code is reused
- our own existing Creator Console code and contracts

Not used:

- proprietary source code
- hidden prompts
- non-public APIs
- vendor credentials or internal assets
- copied branding/trade dress

## 3. Owned contract

`VisualStorySpec` is the canonical product contract. It contains:

- title/subtitle
- format: process, roadmap, comparison, stats, architecture, listicle
- motion: flow, build, pulse
- canvas size
- brand tokens
- 1-8 source-grounded visual items
- source prompt and provenance
- source-only claims policy

The browser preview, durable render worker and MCP adapter all consume the same contract.

## 4. Current architecture

```text
prompt / REA evidence
        ↓
Creator Console planner
        ↓
VisualStorySpec
        ↓
visual QA receipt
  ├─ provenance
  ├─ density
  ├─ contrast
  ├─ occupancy
  ├─ copy budgets
  └─ semantic motion
        ↓
editable browser artboard
        ↓
re-certification after edits
        ↓
Vercel control-plane proxy
        ↓
container render plane
        ↓
existing durable RenderJob queue
        ↓
TemplateDocument compiler
        ↓
FFmpeg worker
  ├─ MP4
  └─ server-side GIF
        ↓
artifact URL + render receipt
```

The render plane deliberately reuses the repository's existing cancellable render jobs, template compiler, usage accounting and FFmpeg worker. It is not a second renderer or queue.

## 5. Creator Console surface

The `/visual-story` Studio supports:

- LinkedIn 1080×1350, square and landscape canvases
- process, roadmap, comparison, stats, architecture and listicle stories
- flow, build and pulse motion
- brand name, handle and color controls
- editable headline and visual items
- PNG export
- browser-native animation fallback
- JSON spec export
- visible QA receipt
- `Durable GIF` action that queues the owned render plane when connected

Edits invalidate the browser QA receipt. Durable rendering always re-certifies the submitted spec on the render plane and returns HTTP 422 when visual QA fails.

## 6. Durable render API

`POST /api/v1/visual-stories/render`

Input:

```json
{
  "spec": "VisualStorySpec",
  "output": "gif | mp4"
}
```

Behavior:

1. resolve workspace/auth boundary
2. validate spec
3. run blocking visual QA
4. enforce render quota
5. enqueue `kind=visual-story-v1`
6. use the existing worker lifecycle and cancellation semantics
7. compile the visual story to the owned template document
8. render MP4 through FFmpeg
9. optionally transcode the certified MP4 to GIF with palette generation
10. persist the artifact URL and usage receipt

`GET /api/v1/render-jobs/:id` reports the job kind, engine and result format.

## 7. MCP / Agent Work OS adapter

The current MCP v2 adapter uses `@modelcontextprotocol/server` and exposes four bounded tools over stdio:

- `visual_story_plan`
- `visual_story_certify`
- `visual_story_render`
- `visual_story_render_status`

Planning/certification are separate from rendering so an agent can inspect or edit a spec before consuming render capacity. The adapter does not publish content, mutate unrelated repository state, merge code or bypass approval gates.

This keeps ownership clear:

- REA discovers and structures evidence
- Creator Console owns visual planning and content production
- the render plane owns durable media execution
- Agent Work OS orchestrates through MCP
- publishing remains a separate approval-gated capability

## 8. Verification receipts

The candidate has independent checks for:

- production dependency audit
- Prisma/SQLite initialization
- ESLint
- strict TypeScript
- Next.js production build
- Creator Console JavaScript syntax
- Creator Console planner + QA tests
- MCP SDK/module availability
- real legacy MP4 render
- real `VisualStorySpec` GIF render with GIF signature and minimum-artifact check
- Docker build and boot
- API acceptance smoke
- plan/quota controls
- fail-closed hosted authentication

The dependency baseline was also repaired: Next.js and transitive vulnerable packages were updated and the regenerated lockfile is committed, so the audit gate is reproducible rather than bypassed.

## 9. Deployment topology and current external gates

Intended deployment topology:

```text
Vercel
  Creator Console UI + lightweight proxy
        │
        └──> Container host
              Next.js render API
              SQLite or hosted DB
              FFmpeg / eSpeak / fonts
              durable RenderJob workers
              persistent /app/data volume
```

Current external gates discovered during this roadmap pass:

- Vercel account reached its free-tier API deployment limit for the day, so a fresh API-created preview cannot currently be forced. Existing Git-connected previews remain available, and code/CI verification is unaffected.
- The connected Railway account reports that its trial has expired, so a new render-plane project cannot be created until the account selects an eligible plan.

These are hosting/account gates, not product-code blockers. No billing or plan change is performed automatically.

## 10. Next owned slices

After a live container host is available, continue in this order:

1. connect `VISUAL_RENDER_BASE_URL` and least-privilege service authentication from Creator Console
2. browser certify the live Durable GIF path and retain exact deployment/SHA receipts
3. persist visual-story versions/assets
4. conversational refine/restyle over `VisualStorySpec`
5. exact cloud/vendor icon registry for technical architecture content
6. carousel / multi-artboard output
7. approval-gated LinkedIn publishing from the rendered artifact
8. engagement analytics → creative feedback loop
9. replay/drift comparison and self-healing visual-template checks
10. cross-product adapters for REA, Traceframe and Presentation OS using the same visual contract

## 11. Product differentiation

The goal is broader than a clone:

- source/evidence provenance is first-class
- one spec can drive browser preview, PNG, durable GIF, MP4, carousel, documentation diagram and presentation artifacts
- motion is semantic and QA-gated rather than decorative
- REA can produce visual stories directly from reverse-engineering evidence
- Agent Work OS can plan, certify, render, verify and replay via bounded tools
- the render path produces durable receipts instead of claiming an artifact that was never actually generated
- approval and exact-SHA shipping gates remain part of the product architecture
