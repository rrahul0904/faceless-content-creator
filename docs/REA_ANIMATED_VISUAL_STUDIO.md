# REA Capability Absorption: Animated Visual Studio

Status: Phase 1 implementation candidate
Tracker: GitHub issue #31

## 1. Target identity

This work absorbs the public product pattern behind prompt-driven animated LinkedIn visuals into the owned Creator Console. The target capability is not treated as a code clone. The external product is a capability reference; the implementation remains inside our own template/render/control plane.

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

The owned implementation uses a new `VisualStorySpec` contract and our existing rendering/publishing architecture.

## 3. REA decomposition

### Evidence and capability discovery

Observed capabilities are reduced to provider-neutral contracts rather than vendor-specific endpoints.

### Owned product contract

`VisualStorySpec` contains:

- title/subtitle
- format: process, roadmap, comparison, stats, architecture, listicle
- motion: flow, build, pulse
- canvas size
- brand tokens
- 1-8 source-grounded visual items
- provenance: deterministic or configured-LLM planning, source-only claims policy

### Planner

`POST /api/v1/visual-story`

- accepts prompt, optional format, motion, size and brand overrides
- uses the repository's existing `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` contract when configured
- falls back to deterministic parsing when no model is configured
- model instructions prohibit invented statistics, product states, customer claims, quotes or benchmarks

### Renderer

The browser artboard renders the same `VisualStorySpec` used for exports. Phase 1 includes:

- native 1080×1350 LinkedIn portrait canvas
- square and landscape variants
- process/architecture/roadmap flow composition
- comparison/stats grid composition
- semantic flow dots, build reveal and pulse focus motion
- direct editing of headline and story items
- PNG export
- browser-native animated MP4/WebM export when supported
- spec JSON export for replay and future worker rendering

## 4. Why this belongs in Creator Console

The repository already owns adjacent platform capabilities: reusable templates, semantic timing, reference-video analysis, render jobs, brand assets, usage controls and social publishing. Animated visual stories therefore become another owned content primitive, not another standalone SaaS clone.

Canonical flow:

```text
research/evidence
  -> VisualStorySpec
  -> still/story quality gate
  -> semantic motion
  -> preview/export
  -> approval
  -> publisher adapter
  -> analytics/replay
```

## 5. Verification gates

Phase 1 candidate must pass:

- ESLint
- strict TypeScript
- Next.js production build
- API request validation
- browser rendering on the deployed preview
- PNG export smoke check
- animated browser export smoke check on at least one supported desktop browser
- responsive UI check
- exact commit/deployment receipt

No production promotion should occur until the preview build and browser checks pass.

## 6. Remaining parity work

The current Phase 1 is a deployable vertical slice, not full vendor parity. Next slices:

1. server-side durable GIF rendering via the existing worker model, so GIF generation is browser-independent
2. persisted visual assets and versions
3. conversational refine/restyle endpoint
4. exact cloud/vendor icon registry for technical architecture content
5. carousel/story multi-artboard generation
6. MCP tools backed by the owned `VisualStorySpec`
7. approval-gated LinkedIn publishing path
8. engagement analytics and creative feedback loop
9. replay/drift comparison and self-healing template checks
10. visual QA agent: occupancy, contrast, dead-zone, density and text-overflow certification

## 7. Product differentiation

The goal is broader than a clone:

- source/evidence provenance is first-class
- one spec can produce animated visual, static graphic, carousel, documentation diagram and presentation artifact
- REA can extract a visual story directly from reverse-engineering evidence
- Agent Work OS can schedule, verify and replay the generation flow
- the same technical visual primitives can integrate with Traceframe / Presentation OS
- approval and exact-SHA receipts remain part of shipping, not an afterthought
