# Orshot reverse engineering and replacement architecture

This document captures the public, observable product contract we need to recreate for Faceless Content Creator. It does not copy Orshot source code. It derives the product primitives from Orshot's public documentation and API behavior so we can implement an independent engine.

## Product thesis

Orshot is not primarily a video API. Its core abstraction is **template -> parameters -> deterministic render**. Images, PDFs, videos, social publishing, workflows and embeds are downstream services around that abstraction.

For our product, the template engine is infrastructure and the customer-facing product is an autonomous short-form content studio.

## Reverse-engineered capability map

### 1. Studio / authoring

A template contains metadata plus one or more pages. Each page owns a canvas and ordered layers.

Core layer types:

- text
- image
- video
- shape
- waveform
- container / generic element

Common layer properties:

- id and display name
- position `{x,y}`
- dimensions `{width,height}`
- rotation
- z-index
- visibility / locking metadata
- API parameterization (`parameterizable`, `parameterId`)
- enter/exit/ambient transitions
- cinematic motion behaviors
- optional group membership

Text needs font family, size, weight, alignment, line height, letter spacing and overflow behavior. Orshot exposes overflow, fit, truncate and flow-to-new-page modes.

Images need object-fit, positioning, borders/radius and effects. Shapes need fill/stroke/radius. Video layers need trim, mute/loop and timing. Waveform layers bind to an audio track.

### 2. Parameterization

A layer can be marked dynamic. The template then exposes a flattened modification contract. Render requests provide a `modifications` object, e.g.

```json
{
  "headline": "Three hearts. One octopus.",
  "hero_image": "https://...",
  "accent.fill": "#d7ff64",
  "headline.fontSize": 84,
  "headline.motion.reveal.stagger": 0.05
}
```

Multi-page parameters are addressable with page prefixes while stable page IDs survive reorder. Canvas background color/image are also dynamic.

Our implementation must support both content replacement and style-path overrides. Modifications are applied to a cloned render document, never mutate the stored template.

### 3. Responsive layout

Orshot has two notable layout systems:

- **Smart Stacking**: layer B anchors relative to layer A, including dependency chains.
- **Smart Resize**: a base layout adapts deterministically to another canvas size using scaling, edge/center anchoring and overlap guards. Saved variants can override the automatic result.

For short-form video this matters because one creative should become 9:16, 1:1 and 16:9 without rebuilding every template.

### 4. Animation and motion

There are two levels:

**Layer transitions**: enter, exit, visibility timing, easing, stagger.

**Motion engine**: semantic behaviors including reveal-by-word/character, typewriter, count-up, wake, dependency-based `after`, pulse, float, press, sleep, SVG draw-in, explicit keyframes and page-level camera moves / film look.

A useful implementation detail from the public contract is that motion is declarative JSON. This is exactly the model we should keep: the editor changes JSON; preview and final renderer consume the same JSON.

### 5. Audio / narration / subtitles

Pages can have multiple audio tracks. A track can be a stored media URL, generated narration recipe or generated sound-effect/ambient recipe. Tracks have volume, fade-in/out, trim, offset, loop, mute and enabled flags.

Subtitles are page-level and include source, font styling, position, phrase vs word-by-word mode, word reveal/highlight behavior and per-line limits.

Our renderer needs word timing rather than the current equal-duration caption chunks. Local TTS remains a fallback; premium neural TTS can be a provider adapter.

### 6. Rendering API

The public Orshot contract has synchronous and asynchronous render modes. Async returns a durable job; clients poll a job endpoint or receive a webhook. Output can be images, PDFs or multiple video formats. Renders accept output size, multiple sizes, page selection and video options.

Our equivalent surface:

- `POST /api/v1/templates/:id/render`
- `GET /api/v1/render-jobs/:id`
- `GET /api/v1/render-jobs`
- `POST /api/v1/render-jobs/:id/cancel`

The worker queue and asset store are implementation details. The API must remain stable when we move from one server to a render farm.

### 7. Assets / brand kit

Workspace-scoped reusable assets:

- images/logos
- colors
- fonts
- videos
- audio

All assets require tags/search. A sellable faceless-content product additionally needs stock-media search, generated media and content-source provenance.

### 8. AI generation

Orshot separates deterministic template rendering from generative video. Its AI-video surface supports generated footage, animated images and talking photos/presenters.

We should copy the separation, not the provider dependency:

- `TemplateRenderProvider` for deterministic branded composition
- `GenerativeVideoProvider` for B-roll / image-to-video / talking-photo generation
- optional provider adapters (local or hosted)

The final video can combine generated clips inside deterministic templates.

### 9. Workflow orchestration

Orshot exposes native workflow CRUD, manual runs and run history. Public product messaging describes schedule/webhook/data-source triggers, render steps, publishing, retries and logs.

Our content product should make these domain-specific rather than a generic n8n clone:

`discover -> research -> script -> assets -> voice -> compose -> review -> schedule -> publish -> analyze`

Each stage is a durable job with idempotency and retries.

### 10. Social publishing and analytics

Social accounts are workspace-scoped OAuth connections. Multiple accounts per platform are represented by stable account IDs. Publishing supports immediate, draft/held and scheduled states. Analytics returns account/post metrics plus computed best-time, frequency and engagement-decay insights.

This is required for the sellable SaaS, but it is separate from the template engine.

### 11. Embed / white label / multi-tenancy

Orshot exposes a white-label editor that can isolate templates and assets per end user. It uses workspace boundaries plus per-user data isolation and supports signed/JWT authorization.

Our SaaS must therefore treat tenancy as a first-class storage key from day one. A template, asset, render, social account and analytics record always belongs to a workspace.

## Independent implementation architecture

```text
Web SaaS
  Studio editor
  Content workspace
  Template gallery
  Review + calendar
  Analytics
       |
       v
Template service
  template JSON schema
  modifications compiler
  responsive layout compiler
  motion compiler
       |
       +-------------------+
       |                   |
       v                   v
Preview renderer       Render queue
(browser)                  |
                          worker pool
                          |- HTML/SVG frame compositor
                          |- FFmpeg encoder
                          |- audio mixer
                          |- subtitle engine
                          |- image/PDF renderer
                          v
                      Object storage/CDN

Generative media adapters -> template media layers
Social OAuth/publish adapters -> completed render
Analytics adapters -> optimization loop
```

## Delivery order

1. Template document schema and validation.
2. Parameter extraction and modification compiler.
3. Template CRUD and versioning.
4. Browser Studio editor using the same schema.
5. Deterministic page renderer for text/image/shape layers.
6. Video timeline + layer transitions.
7. Audio mixer + accurate word-timed subtitles.
8. Multi-page scene composition and page transitions.
9. Smart stacking and resize variants.
10. Brand asset library.
11. Generative-video provider interface and adapters.
12. Render queue/farm and object storage.
13. Workflow engine.
14. OAuth social publishing.
15. Analytics and performance feedback.
16. SaaS tenancy/auth/billing/credits.

## What the old local renderer becomes

The original `worker/local-renderer.mjs` is useful as a smoke-test renderer, but it is not the product architecture. It will remain temporarily as a compatibility backend while the template compiler reaches parity. Once the generic template renderer passes the same HTTP/Docker smoke tests, the hard-coded templates can be removed.
