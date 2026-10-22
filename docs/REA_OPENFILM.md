# REA intake — OpenFilm → Agent Film Studio

Date: 2026-10-19
Status: **SOURCE VERIFIED / DONOR EXTENSION / IMPLEMENTED FIRST SLICE / UNVERIFIED PRODUCT SHIP**
Governance: https://github.com/rrahul0904/agent-work-os/issues/303
Product branch: `rea/openfilm-agent-video-20261019`

## 1. Evidence / provenance

- Reddit source: https://www.reddit.com/r/BuildWithClaude/comments/1x9h0kx/
- Upstream: https://github.com/openfilm/openfilm
- Inspected upstream main SHA: `120193c63329c61ae2863dd681f6c5ed31b5a9bf` (2026-10-18).
- Upstream specification: `packages/openfilm/SPEC.md` (draft 0.1).
- Upstream root and package licensing: MIT, © 2026 OpenFilm contributors. OpenFilm naming/marks are separately protected. We independently implemented the declarative FilmPlan module here and copied no source implementation/branding.

## 2. What OpenFilm actually offers

Agent writes `film.html` timeline sections plus HTML/CSS/JS pages with `window.film.frame(t)`; local Studio exposes clip timeline, live preview, editable element overrides and versions, FFmpeg/Chromium rendering, AI-media providers and desktop-agent integration. Deterministic frame sampling is an explicit protocol requirement. Public workflows: describe → agent generate scenes/assets → inspect → preview → adjust on canvas/timeline → render/export. Reported target surfaces include macOS/Windows desktop and browser Studio; check official supported platform/packaging when deploying.

Upstream strengths: broad web rendering semantics, model-neutral agent CLI workflow, reproducible visual frames, direct manipulation that survives agent edits, video/audio tracks, multi-format export. Open problems for our owned product: guardrails for arbitrary agent-authored scripts, verified workspace-owned assets/URLs, render cost accounting, multi-tenant safe previews, parity between preview and export, agent-approval boundaries and signed receipts.

## 3. Why this is a DONOR / EXTENSION, not another repository

`faceless-content-creator` owns the video/creator product and already ships a versioned template schema, browser Studio, local FFmpeg pipeline, optional TTS, durable render queue, authenticated workspaces, plan limits and social adapters. `agent-work-os` owns REA intake, orchestration, evidence and deployment gates. A separate video editor repository would create two competing source-of-truth products.

## 4. First implementation: FilmPlan v1 (not OpenFilm format compatibility)

`lib/agent-film/film-plan.mjs` accepts strictly bounded declarative JSON and compiles it to the existing `TemplateDocumentSchema` with editable Studio pages.

| Field | Contract |
| --- | --- |
| `name` | non-empty, max 120 characters |
| `format` | portrait (1080×1920), landscape (1920×1080), square (1080×1080) |
| `scenes` | 1–8 ordered scenes, each 2–45s, total ≤180s |
| `scene.layers` | 1–30 independently editable timed layers; unique IDs |
| `type: text` | literal (not HTML) text, solid text color, font size, normalized bounds and [start,end] |
| `type: shape` | rectangle, fill, bounds, start/end |
| `narration` | optional local eSpeak NG TTS + existing subtitle pipeline |

Frames use 0–1 normalized rectangles; compiler converts to canvas pixels without spilling past the stage. Every output page has an explicit duration. Layers retain `showAt`/`hideAt` and parameter IDs for the existing Studio. All unknown source, iframe, arbitrary JS and remote video URLs are rejected by layer-type allowlist, preventing the new intake from turning into an arbitrary-code/video-network execution endpoint.

Deterministic compiler returns a SHA-256 of normalized input, the output document, scene count and planned duration. This digest is a **plan fingerprint, not proof of a rendered MP4**.

## 5. API

`POST /api/v1/agent-films` using existing workspace authentication.

```json
{
  "plan": {
    "name": "Product launch",
    "format": "portrait",
    "scenes": [{
      "id": "hook",
      "name": "Hook",
      "duration": 5,
      "background": "#111827",
      "narration": "One idea. One video.",
      "layers": [{
        "id": "headline",
        "type": "text",
        "text": "BUILD FASTER",
        "start": 0.5,
        "end": 4.5,
        "bounds": {"x": 0.1, "y": 0.2, "width": 0.8, "height": 0.3}
      }]
    }]
  },
  "dryRun": true,
  "render": false
}
```

- `dryRun=true`: validate, compile, and return editable template JSON without DB writes.
- Default create: persist a versioned Studio template and return `templateId`.
- `render=true`: check workspace render-job limit, persist, queue through existing FFmpeg worker; poll `/api/v1/render-jobs/:id`.
- UI: `/film` with natural-language script drafting through the existing content service, JSON edit, storyboard preview, click-to-edit text/color/timing inspector, validate/save/render; edit generated pages further at `/studio`.
- Hosted mode needs valid workspace API key. API limits request JSON to 128 KiB.

## 6. Test coverage and gates

Local pure contracts: `node --test lib/agent-film/film-plan.test.mjs`. Real newly-compiled film to H.264 MP4 with local narration: `node --test scripts/smoke-agent-film-render.test.mjs` (requires FFmpeg, ffprobe, espeak-ng, DejaVu font).
HTTP contract after app boot: `node scripts/smoke-agent-film.mjs`.

Covered: stable normalization/hash, timing/layout conversion, narration/subtitles, format bounds, duplicate IDs, nonfinite or out-of-range values, URL-bearing video rejection, inert text, dry-run, workspace template creation and denial of invalid bearer tokens. CI includes lint/TS/build/Docker/FFmpeg acceptance plus the dedicated FilmPlan-origin MP4 render test. Treat it as unverified until the latest branch run reports pass.

Known limits: no rich timeline scrubbing or drag-to-reposition in `/film`; clickable storyboard text/shape has a basic text/color/timing inspector, template Studio is the richer editor; only text/shape local content; FFmpeg uses audio extent and a minimum scene duration so declared planned duration and encoded MP4 duration can diverge when TTS narration runs long. Not yet feature-equivalent to OpenFilm.

## 7. Follow-on roadmap

1. **Agent workflow** — multi-provider tool schema, script-to-scene planner, robust plan critique and correction loop with human approval.
2. **Workspace media** — owner-verified asset IDs resolved locally at render time, no untrusted remote network fetching, transcoding and per-track audio/video trims.
3. **Real film timeline** — frame/scrubber controls, tracks, ripple edits, transitions, beat alignment, text/element selection, persistent manual overrides.
4. **Deterministic parity** — render-preview matching at frame timestamps, screenshot diff testing, manifest hashes, fonts, alpha compositing, failure receipts.
5. **Export and packaging** — MP4/GIF/SRT/project interchange, FCPXML/OTIO if supported, portable desktop packaging and responsive read-only mobile review.
6. **Product gates** — a tested FilmPlan-to-MP4 smoke, security/tenant isolation audit, subscription accounting, UAT, exact-SHA CI and deployment receipts. No silent merge/deployment.

Completion is based on observed receipts, not a speculative percentage.

## 8. Continued intake (2026-10-21) — second Reddit source and timeline inspector

- New Reddit source: https://www.reddit.com/r/coolgithubprojects/comments/1xbxp4k/ (same underlying OpenFilm project; no new product/repo).
- Refreshed upstream main SHA: `af5756a88d362bdcd71dc870a0e02590420e6944` (2026-10-21T22:02:20Z, versioning commit for 0.2.5); previous 2026-10-18 baseline retained above for reproducibility.
- Refreshed upstream release: [v0.2.5](https://github.com/openfilm/openfilm/releases/tag/v0.2.5), published 2026-10-21T22:25:58Z. Changes worth evaluating separately: faster/lower-disk editing-project exports, frame transparency consistency, reusable browser processes, cancellation cleanup, updated FFmpeg desktop versions, volume in dB and another desktop agent adapter. These are upstream claims, not verified features in our implementation.
- New owned implementation: `lib/agent-film/timeline.mjs` pure, deterministic global playhead → scene/local-time/layer-visibility resolver, with matching TypeScript declaration and 5 independent Node tests. `app/film/page.tsx` now exposes a global scrub slider, automatically follows scene cuts, and hides layers outside their start/end interval; clicking a scene sets the playhead to that scene's start.
- Test receipt: local `node --test lib/agent-film/timeline.test.mjs` **5/5 pass** before GitHub commit; CI adds a dedicated timeline-contract step. This does **not** certify final rendered pixel parity or production deployment.
- Previous exact-head CI: [39201845873](https://github.com/rrahul0904/faceless-content-creator/actions/runs/39201845873) at `f7044717f8bff5dcd20de157423422684d24ee62`: compiler, lint, typecheck, build, real MP4, Docker, HTTP smoke, limits, and hosted auth passed; security dependency audit failed; Vercel status failure was build-rate-limit, not deployment success.
- Remaining release blocker: [#37](https://github.com/rrahul0904/faceless-content-creator/issues/37). Do not merge or deploy until dependencies are patched and latest SHA CI/audit/UAT are clean.
- Next gates: validate CI on the new scrubber head; exact-frame preview/render comparison; tenant-approved media asset IDs and safe transcoding; multi-track audio; export formats; production auth and UAT. Avoid executing arbitrary uploaded HTML/JS and protect manual timeline edits from agent regeneration.
