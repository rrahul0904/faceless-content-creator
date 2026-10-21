# REA: SuperCMO-inspired creative production (2026-10-21)

## Original evidence, licensing, and scope

- User input: https://www.reddit.com/r/buildinpublic/s/xUfgjXjqcw
- Resolved post: https://www.reddit.com/r/buildinpublic/comments/1xblzhz/
- OSS: https://github.com/SupercmoHQ/superCMO-skills at commit `3bf78a423b1ba27a1f500b3b50f806b86cc5bdab`.
- Root OSS license: Apache-2.0, NOTICE copyright 2026 Kshitiz Kumar. Bundled Inter fonts have SIL OFL-1.1; do not vendor upstream fonts without license review. Hosted SuperCMO is separate and not presumed open source.
- Upstream components observed: skills for brand/product analysis, campaign planning, scripts, casting, reference-anchored storyboards, image/video/audio production and stitching, local Python MCP, installer, vendor BYOK routing. Current main tree at SHA above has 293 entries.
- Upstream README pricing/consistency claims are **author assertions**; there has been no external commercial or quality benchmark. Model spend, clip length and reliability are provider/model dependent.
- Telemetry: `TELEMETRY.md` says opt-out usage measurements to a first-party endpoint then PostHog. We do not incorporate or run upstream installer, service or telemetry.
- REA governance: https://github.com/rrahul0904/agent-work-os/issues/356
- Creator Console slice: https://github.com/rrahul0904/faceless-content-creator/issues/42
- Related DistribPal campaign ideation: #40 / draft PR #41. That owns product-to-campaign topics and schedules; **this slice owns per-creative production preview and shot continuity**.

## Architecture and owned seams

```text
Trusted caller → workspace-key auth → workspace brandAsset ownership check
           → local factual input validation / source-link checks
           → content-addressed concept + script + time-coded shot plan (0 media calls)
           → explicit human concept/rights/cost approval (NOT implemented yet)
           → future provider quote & job submission via adapter (NOT implemented)
           → future FFmpeg edit, output QC, artifact provenance
           → future separately-approved native publishing
```

The initial slice writes no persistent campaign state; it is a deterministic preview, not a media generator. It never makes provider calls, payment, telemetry, login, scheduler or publish requests. Upstream code is not copied.

## Executable slice

- `lib/creative-production/preview.ts`: deterministic generation-free plan, workspace-bound SHA-256 preview ID, visual anchors carried to every shot, source URL validation, grounded claims only.
- `app/api/v1/creative-production/preview/route.ts`: Zod shape validation, workspace authentication, tenant-owned brand asset check, metered rate enforcement, and JSON response. *A supplied link alone is not independently verified proof.*
- `app/creative-production/page.tsx`: real local-mode user interface at `/creative-production`; reads tenant image assets, submits a factual brief and displays time-coded shots without charging or posting. Hosted mode fails closed until proper customer sign-in/session support is built. There is intentionally no misleading media-generation button.
- `scripts/test-creative-production.mjs`: native offline tests for repeatability, tenant digest isolation, visual continuity, exact timing, rejection of missing evidence, path traversal and private/invalid URLs, unsupported options and invalidation when facts change.
- `.github/workflows/creative-production-preview.yml`: scoped tests, no keys.

To verify offline on Node 22:

```sh
node --experimental-strip-types --test scripts/test-creative-production.mjs
```

Request (requires a brand asset belonging to the caller workspace):

```json
{
  "product": {
    "name": "Example Tumbler",
    "assetId": "A_REAL_BRAND_ASSET_ID",
    "visualAnchors": ["matte purple body", "silver lid"],
    "claims": [{"text":"The tumbler has a removable lid","sourceUrl":"https://example.org/products/tumbler"}]
  },
  "brief": {
    "format": "ugc",
    "audience": "commuters",
    "objective": "awareness",
    "channel": "instagram",
    "durationSeconds": 30
  }
}
```

Output includes `creative-v1-<sha256>`, `shots`, `concept`, `evidenceStatus`, `controls.generationAllowed=false`, `controls.publishingAllowed=false`, and `controls.quote.estimatedUsd=null`. `sourceUrl` is retained as a pointer **without being fetched or fact-checked**. Visual anchors are user assertions, not yet computer-vision measurements. Actor is synthetic-only; no actual actor is selected, consented or rendered.

## Follow-on acceptance criteria (all OPEN)

1. Frontend creative review/editor, claim checks and accessible storyboards. No assertion that prompt-produced scripts are production quality without UAT.
2. Verified ownership and licensing for all source media, faces/voices, likeness releases and synthetic-media disclosure; no impersonation or fabricated endorsements.
3. Provider catalog with explicit version, available durations, quote endpoint, cost hard limits, retries and idempotency. BYOK never silently routed to managed proxy. Provider pricing cannot be hardcoded from marketing copy.
4. Durable tenant-scoped generation jobs with separate approved spend receipt; no spend on preview. Avoid unbounded provider polling and runaway retries.
5. Media consistency evaluation (same product reference/actor), audio timing, captions, ffprobe, actual MP4 visual QA and replayed evidence digest.
6. Per-platform publishing with independent user authorization and approval, safety/policy checks, schedule receipts and analytics.
7. End-to-end CI/browser/real render/provider sandbox/tenant negative tests and human UAT at an exact reviewed SHA. Merge/deploy stays gated.

**Current status: implemented offline preproduction prototype on research branch, not a completed media product.**
