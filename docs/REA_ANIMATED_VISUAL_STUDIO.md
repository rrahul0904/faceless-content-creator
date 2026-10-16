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
- original source prompt and provenance
- append-only refinement provenance
- source-only claims policy

The browser preview, persisted version store, durable render worker and MCP adapter all consume the same contract.

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
  ├─ bounded deterministic transform
  ├─ original sourcePrompt retained
  ├─ refinement provenance appended
  └─ QA regenerated
        ↓
new immutable version
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
artifact URL + visualStoryId/version receipt
```

The render plane deliberately reuses the repository's existing cancellable render jobs, template compiler, usage accounting and FFmpeg worker. It is not a second renderer or queue.

## 5. Creator Console surface

The `/visual-story` Studio supports:

- LinkedIn 1080×1350, square and landscape canvases
- process, roadmap, comparison, stats, architecture and listicle stories
- flow, build and pulse motion
- brand name, handle and color controls
- editable headline and visual items
- persisted project creation
- immutable `Save version` flow
- conversational `Refine + save version`
- PNG export
- browser-native animation fallback
- JSON spec/export receipt
- visible QA receipt
- `Durable GIF` through the owned render plane

Manual edits invalidate the browser QA receipt. Before a durable render, dirty browser edits are persisted as a new version first; the render plane then re-certifies that persisted version. This prevents a rendered artifact from silently pointing at an older saved spec.

Current bounded refinement language supports:

- title/headline changes
- format changes
- motion changes
- portrait/square/landscape canvas changes
- primary/accent/background/text hex colors
- concise/reduce-copy requests
- labels-only / remove details
- remove numbered item
- `add item: Label | Detail | Value`

Unsupported instructions fail with `REFINEMENT_NOT_UNDERSTOOD` rather than silently inventing a transformation.

## 6. Persistence and durable render API

Persistence endpoints:

- `GET/POST /api/v1/visual-stories`
- `GET/PUT/DELETE /api/v1/visual-stories/:id`
- `GET /api/v1/visual-stories/:id/versions`
- `GET/POST /api/v1/visual-stories/:id/versions/:version`
- `POST /api/v1/visual-stories/:id/refine`

Restore is non-destructive: restoring an older version creates a new current version rather than mutating history.

Durable render endpoints:

- `POST /api/v1/visual-stories/render` for an ad-hoc spec
- `POST /api/v1/visual-stories/:id/render` for a persisted story
- `GET /api/v1/render-jobs/:id` for job/artifact status

Persisted rendering re-loads the current saved spec, runs blocking QA, enforces quota, queues `kind=visual-story-v1`, and records `visualStoryId + version` in the render input/receipt.

## 7. MCP / Agent Work OS adapter

The MCP v2 adapter uses `@modelcontextprotocol/server` and exposes five bounded tools over stdio:

- `visual_story_plan`
- `visual_story_certify`
- `visual_story_refine`
- `visual_story_render`
- `visual_story_render_status`

`visual_story_refine` only operates on a persisted story and appends an immutable version. `visual_story_render` accepts exactly one of an ad-hoc spec or a persisted story ID; using a persisted story preserves version provenance in the render receipt.

The adapter does not publish content, mutate unrelated repository state, merge code or bypass approval gates.

Ownership remains clear:

- REA discovers and structures evidence
- Creator Console owns visual planning, editing and versioned creative state
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
- MCP SDK/module availability
- real legacy MP4 render
- real `VisualStorySpec` GIF render with GIF signature and minimum-artifact check
- Docker build and boot
- authenticated immutable-version acceptance
- authenticated conversational-refinement acceptance
- API acceptance smoke
- plan/quota controls
- fail-closed hosted authentication

Persistence acceptance proves create v1 → edit v2 → retrieve unchanged v1 → restore v1 as new v3.

Refinement acceptance proves a conversational instruction creates a new version, applies the requested title/format/motion changes, retains the original source prompt, appends refinement provenance, regenerates QA, and leaves v1 unchanged.

The dependency baseline was also repaired: Next.js and transitive vulnerable packages were updated and the regenerated lockfile is committed, so the audit gate is reproducible rather than bypassed.

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

After this versioning/refinement milestone, continue in this order:

1. connect `VISUAL_RENDER_BASE_URL` and least-privilege service authentication on a live container host
2. browser-certify save/refine/render against exact deployment/SHA receipts
3. exact cloud/vendor icon registry for technical architecture content
4. carousel / multi-artboard output from the same visual story
5. approval-gated LinkedIn publishing from a certified rendered artifact
6. engagement analytics → creative feedback loop
7. replay/drift comparison and self-healing visual-template checks
8. cross-product adapters for REA, Traceframe and Presentation OS using the same visual contract

## 11. Product differentiation

The goal is broader than a clone:

- source/evidence provenance is first-class
- refinement is versioned rather than destructive
- one spec can drive browser preview, PNG, durable GIF, MP4, carousel, documentation diagram and presentation artifacts
- motion is semantic and QA-gated rather than decorative
- REA can produce visual stories directly from reverse-engineering evidence
- Agent Work OS can plan, certify, refine, render, verify and replay via bounded tools
- the render path produces durable receipts tied to a persisted story version
- approval and exact-SHA shipping gates remain part of the product architecture
