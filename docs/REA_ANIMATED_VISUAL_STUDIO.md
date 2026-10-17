# REA Capability Absorption: Animated Visual Studio

Status: Phase 2 implementation candidate
Tracker: GitHub issue #31
Canonical branch: `feature/animated-visual-studio`

## 1. Target identity

This work absorbs the public product pattern behind prompt-driven animated LinkedIn visuals into the owned Creator Console. The target capability is not treated as a code clone. The external product is a capability reference; the implementation remains inside our own planning, versioning, template, render and publishing control planes.

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
- governed technical icon keys
- original source prompt and provenance
- append-only refinement provenance
- source-only claims policy

The browser preview, persisted version store, durable render worker, carousel compiler and MCP adapter all consume the same contract.

## 4. Current architecture

```text
prompt / REA evidence
        ↓
Creator Console planner
        ↓
VisualStorySpec
        ↓
visual QA receipt
        ↓
editable browser artboard
        ↓
Save project / Save version
        ↓
workspace-owned VisualStory
        ↓
append-only VisualStoryVersion
        ↓
conversational refine instruction
        ↓
new immutable version
        ├──> durable GIF / MP4 render
        └──> deterministic carousel compiler
              ├─ portrait artboards
              ├─ stable item ordering
              ├─ per-slide QA receipt
              └─ source story/version provenance
```

The render plane deliberately reuses the repository's existing cancellable render jobs, template compiler, usage accounting and FFmpeg worker. Carousel compilation does not introduce a second source content model; it derives slide specs from the same saved `VisualStorySpec`.

## 5. Creator Console surface

The `/visual-story` Studio supports:

- LinkedIn 1080×1350, square and landscape canvases
- process, roadmap, comparison, stats, architecture and listicle stories
- flow, build and pulse motion
- brand name, handle and color controls
- editable headline and visual items
- governed technical icon keys with explicit fallback behavior
- persisted project creation
- immutable `Save version` flow
- conversational `Refine + save version`
- PNG export
- browser-native animation fallback
- JSON spec/export receipt
- visible QA receipt
- `Durable GIF` through the owned render plane

Manual edits invalidate the browser QA receipt. Before a durable render, dirty browser edits are persisted as a new version first; the render plane then re-certifies that persisted version. This prevents a rendered artifact from silently pointing at an older saved spec.

## 6. Persistence, refinement, icons and carousel APIs

Persistence endpoints:

- `GET/POST /api/v1/visual-stories`
- `GET/PUT/DELETE /api/v1/visual-stories/:id`
- `GET /api/v1/visual-stories/:id/versions`
- `GET/POST /api/v1/visual-stories/:id/versions/:version`
- `POST /api/v1/visual-stories/:id/refine`

Restore is non-destructive: restoring an older version creates a new current version rather than mutating history.

Governed icon endpoint:

- `GET /api/v1/visual-story-icons`

Carousel endpoints:

- `POST /api/v1/visual-stories/carousel` for an ad-hoc spec
- `POST /api/v1/visual-stories/:id/carousel` for the current persisted version

The carousel compiler groups the original story items deterministically, preserves item order/content, normalizes each artboard to 1080×1350 portrait, runs the existing visual QA on every slide, and returns the persisted `visualStoryId + version` when compiled from a saved project. It fails closed with the blocked slide receipts if any artboard does not pass QA.

Durable render endpoints:

- `POST /api/v1/visual-stories/render` for an ad-hoc spec
- `POST /api/v1/visual-stories/:id/render` for a persisted story
- `GET /api/v1/render-jobs/:id` for job/artifact status

Persisted rendering re-loads the current saved spec, runs blocking QA, enforces quota, queues `kind=visual-story-v1`, and records `visualStoryId + version` in the render input/receipt.

## 7. MCP / Agent Work OS adapter

The MCP v2 adapter uses `@modelcontextprotocol/server` and exposes bounded tools over stdio for planning, QA certification, governed icon discovery, refinement, durable rendering and render status. Publishing remains outside this capability and approval-gated.

Ownership remains clear:

- REA discovers and structures evidence
- Creator Console owns visual planning, editing and versioned creative state
- the carousel compiler derives multi-artboard output from the same visual contract
- the render plane owns durable media execution and receipts
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
- governed technical-icon registry certification
- MCP SDK/module availability
- real legacy MP4 render
- real `VisualStorySpec` GIF render with GIF signature and minimum-artifact check
- Docker build and boot
- authenticated immutable-version acceptance
- authenticated conversational-refinement acceptance
- authenticated carousel compilation acceptance
- API acceptance smoke
- plan/quota controls
- fail-closed hosted authentication

Carousel acceptance proves a five-item source story compiles into three portrait artboards at two items per slide, every slide passes QA, item order/content is unchanged, and persisted compilation returns exact story/version provenance.

## 9. Deployment topology and current external gates

Intended deployment topology:

```text
Vercel
  Creator Console UI + lightweight proxy
        │
        └──> Container host
              Next.js visual-story/render API
              persistent DB/data
              FFmpeg / eSpeak / fonts
              durable RenderJob workers
              immutable visual-story versions
```

Current external gates discovered during this roadmap pass:

- Vercel account reached its free-tier API deployment limit for the day, so a fresh API-created preview cannot currently be forced. Existing Git-connected previews remain available, and code/CI verification is unaffected.
- The connected Railway account reports that its trial has expired, so a new render-plane project cannot be created until the account selects an eligible plan.

These are hosting/account gates, not product-code blockers. No billing or plan change is performed automatically.

## 10. Next owned slices

Continue in this order:

1. connect `VISUAL_RENDER_BASE_URL` and least-privilege service authentication on a live container host
2. browser-certify save/refine/render against exact deployment/SHA receipts
3. Creator Console carousel preview/export UI backed by the certified compiler
4. MCP carousel tool over the same compiler
5. approval-gated LinkedIn publishing from a certified rendered artifact
6. engagement analytics → creative feedback loop
7. replay/drift comparison and self-healing visual-template checks
8. cross-product adapters for REA, Traceframe and Presentation OS using the same visual contract

## 11. Product differentiation

The goal is broader than a clone:

- source/evidence provenance is first-class
- refinement is versioned rather than destructive
- technical icons are governed rather than arbitrary image URLs
- one spec can drive browser preview, PNG, durable GIF, MP4, carousel, documentation diagram and presentation artifacts
- carousel compilation is deterministic and QA-gated per artboard
- motion is semantic and QA-gated rather than decorative
- REA can produce visual stories directly from reverse-engineering evidence
- Agent Work OS can plan, certify, refine, render, verify and replay via bounded tools
- the render path produces durable receipts tied to a persisted story version
- approval and exact-SHA shipping gates remain part of the product architecture
