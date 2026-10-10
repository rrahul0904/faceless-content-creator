# Seamless Motion Loop Studio — Reverse-Engineering Dossier

Status: **research + clean-room specification only**  
Source audit date: **2026-10-10**  
GitHub issue: **#27**  
Canonical destination: **faceless-content-creator**  
Tracker ID: **pending collision-safe canonical reconciliation**

## 1. Source manifest

### Primary donor

- Reddit: `r/vibecoding` — “Using ChatGPT image gen and Kling video to create seamless motion loops”
- Canonical post URL: https://www.reddit.com/r/vibecoding/comments/1x2kxuq/using_chatgpt_image_gen_and_kling_video_to_create/
- Publicly observable behavior at audit time:
  - Creator states the loop is **10 seconds** long.
  - The posted preview repeats that loop **twice**.
  - Workflow is described as ChatGPT image generation followed by Kling video generation.
- Comment evidence: the post was only minutes old at audit time and no substantive public comments were retrievable. Treat feedback requirements as `PENDING_REAUDIT`, never as “no feedback exists.”

### Current public provider evidence

Verified on 2026-10-10 from public documentation:

- OpenAI image generation currently supports GPT Image generation/editing through the Images API and image-generation tool. Product code must use a provider adapter rather than embed a marketing model name in domain contracts.
- fal exposes Kling image-to-video endpoints with start/end-frame conditioning.
- Current Kling v3/O3 endpoints surfaced through fal support roughly **3–15 second** durations depending on endpoint, optional end-frame images, and asynchronous queue-style execution.

These are **provider capabilities**, not evidence that our product is implemented, seamless-certified, fast, cheap, or production-ready.

## 2. Dedupe decision

This source is **not a standalone product** in our portfolio.

It maps into the existing `rrahul0904/faceless-content-creator` product because that repository already owns the relevant product surface and infrastructure direction:

- AI media generation
- render jobs
- reference-video analysis
- semantic video/timing concepts
- FFmpeg-oriented media processing
- creator-console surface
- provider abstraction / GPU-generation direction

The donor contributes one bounded capability that is not yet explicitly productized:

> **Generate, evaluate, repair, preview, and export short seamless motion loops with evidence-backed seam certification.**

## 3. Clean-room boundary

We reproduce the **observable job and behavior**, not donor implementation details.

Allowed:

- independently designed product workflow
- public provider APIs and documented schemas
- owned prompts / motion recipes
- owned UI
- standard media processing such as FFmpeg
- independently designed seam metrics and receipts

Excluded:

- copying private or proprietary prompts/settings
- copying donor branding, UI, media, or hidden presets
- inferring hidden model parameters from a single preview
- claiming proprietary internals
- claiming a “perfect” or “seamless” result without artifact-level verification

## 4. Product thesis

Add a **Loop Studio** capability:

`brief or image → motion plan → start/end strategy → generation → seam analysis → bounded repair/retry → repeated preview → accept/export → receipt`

The product advantage is not merely calling an image-to-video model. The owned value is the **closed-loop certification workflow** around generation.

## 5. User workflow

### Input

A user can:

1. upload an image they own/have permission to use; or
2. generate a source image through an image-provider adapter.

They choose:

- loop duration
- aspect ratio / resolution target
- motion recipe
- motion strength
- camera behavior
- optional negative constraints
- output target

### Motion recipes

Owned presets should be semantic rather than provider-prompt copies, for example:

- ambient drift
- subtle orbit
- breathing / idle character
- cloth or hair sway
- rain / smoke / steam
- particle circulation
- light flicker / shadow drift
- water / reflection motion
- shallow parallax

Each preset compiles to a provider-specific prompt/parameter request through an adapter.

### Generation

Preferred first strategy:

- same source image as the start frame
- same or deliberately reconstructed source as the end frame
- prompt requests cyclical, low-discontinuity motion
- duration bounded to provider-supported range

The system records the exact request semantics and returned artifact digest.

### Seam analysis

Never inspect only frame 0 vs final frame.

Analyze a configurable head/tail temporal window. Phase B should support at least:

- pixel-distance metric after normalization
- SSIM-style structural similarity
- temporal derivative / motion discontinuity around the join
- optional perceptual/embedding metric

The acceptance decision is made from a **versioned threshold policy**.

### Bounded repair

If a loop fails, apply only recorded, bounded strategies:

1. regenerate with stricter cyclic-motion constraints;
2. use explicit same-frame end conditioning when supported;
3. trim an unstable tail/head region;
4. apply a short crossfade and record it as post-processing;
5. optionally use interpolation/optical-flow only when independently implemented and verified.

Every retry has a reason and maximum retry count.

### Preview and export

Before acceptance, render a preview that repeats the candidate **at least twice**. This deliberately mirrors the user-visible test that exposed the donor behavior while remaining our independent QA method.

Exports should support MP4 first, with WebM/GIF compatibility later if the existing renderer supports them safely.

## 6. Owned contracts

Proposed TypeScript domain contracts:

```text
LoopProject
LoopSource
LoopMotionPlan
LoopGenerationRequest
LoopGenerationAttempt
LoopSeamMetric
LoopRepairPlan
LoopArtifact
LoopReceipt
LoopProviderAdapter
```

### LoopReceipt minimum fields

```text
schemaVersion
projectId
requestId
attemptId
sourceDigest
motionPlanDigest
providerId
providerModelRevision
requestedDurationMs
observedDurationMs
fps
width
height
startEndStrategy
artifactDigest
seamPolicyVersion
seamMetrics[]
repairOperations[]
retryCount
retryReasons[]
decision: certified | acceptable | rejected
createdAt
```

A receipt must be immutable once accepted and must never contain provider secrets.

## 7. Phase plan

### Phase A — deterministic contracts and analyzer core

No live vendor dependency.

Build:

- TypeScript/Zod domain contracts
- deterministic fake provider
- pure seam-score aggregator over supplied frame-analysis facts
- versioned threshold policy
- retry/repair state machine
- immutable receipt generation
- cancellation/idempotency behavior

Required negative tests:

- missing media metadata
- missing frame analysis
- invalid duration
- unsupported dimensions
- provider failure
- rejected seam
- retry exhaustion
- duplicate completion callback
- cancellation during attempt

Gate:

- lint
- typecheck
- build
- focused deterministic tests
- exact branch/head SHA captured

### Phase B — local media plumbing

Build:

- FFmpeg metadata probe
- head/tail frame extraction
- repeated-preview renderer
- MP4 export
- deterministic fixture loop
- crossfade repair with explicit receipt entry
- artifact hashing

Gate:

- fixture replay produces the expected decision and stable receipt fields
- repeated preview can be visually inspected without hidden provider state

### Phase C — live image-to-video provider adapter

Initial candidate: Kling through fal because current public API surfaces start/end frame conditioning and async execution.

Build:

- server-only credential handling
- submit/status/result normalization
- timeout/cancellation
- bounded polling/backoff
- provider error mapping
- artifact download/retention policy

Gate:

- deterministic CI still uses fake provider
- live credentialed run is separate evidence
- no claim of provider behavior from mock-only tests

### Phase D — optional OpenAI image adapter

Build:

- source image generation/editing adapter
- prompt digest
- output digest
- model/revision receipt field when known
- upload/manual-image path remains first-class

Gate:

- provider secrets remain server-side
- model marketing name does not leak into core domain contracts

### Phase E — Creator Console Loop Studio

UI flow:

1. source
2. motion recipe
3. generation settings
4. attempt timeline
5. seam score and failure explanation
6. compare attempts
7. 2–3 cycle preview
8. accept/export

The UI should expose confidence and evidence, not just “Generate” and a video player.

### Phase F — bounded benchmark

Create an owned benchmark across 8–12 loop classes.

Measure:

- seam metric
- visible pop/jump rate
- temporal drift
- subject/scene consistency
- retry rate
- successful certification rate
- provider latency/cost only when measured on fixed date/model/settings

Never generalize one provider run into a durable quality/cost claim.

### Phase G — hosted UAT and promotion

Before `READY`, `DEPLOYED`, or `PRODUCTION`:

- exact-head CI green
- browser UAT create→generate→analyze→repeat→export
- cancellation and retry evidence
- secret-leak check
- preview deployment verified
- artifact/receipt hashes captured
- independent acceptance review
- production promotion remains a separate explicit gate

## 8. Capability matrix

| Capability | Donor evidence | Existing owned base | This slice |
|---|---|---|---|
| AI source image | described via ChatGPT | adjacent AI generation work | adapter later |
| Image-to-video | described via Kling | adjacent AI-video/provider work | adapter later |
| Start/end conditioning | verified in current public provider docs | not yet loop-specific | Phase C |
| Loop-specific motion recipes | inferred product need | not explicitly productized | Phase E |
| Objective seam scoring | not evidenced by donor | missing | Phase A/B |
| Bounded repair/retry | not evidenced by donor | generic jobs may exist | Phase A/B |
| Repeated-cycle preview | donor visibly repeats loop twice | missing loop-specific UX | Phase B/E |
| Evidence receipt | our roadmap requirement | existing evidence-oriented direction | Phase A |
| Benchmark/certification | not donor evidence | missing | Phase F |

## 9. Failure modes to design for

- first and last frame match but velocity/motion direction jumps
- exposure/color shifts at the seam
- camera drift causes cumulative mismatch
- subject identity changes
- background geometry morphs
- provider ignores end-frame conditioning
- generated audio makes loop visibly/audibly discontinuous
- metadata duration differs from requested duration
- provider returns corrupt/partial file
- retry storm / unbounded spend
- misleading UI marks a loop “perfect” without metrics
- post-processing hides a weak generated seam without recording the modification

## 10. First implementation slice

Issue #27 owns Phase A.

The first code change should implement only deterministic contracts, policy, fake-provider attempt facts, receipt construction, and tests. Do **not** add live provider calls until those contracts are stable.

## 11. Truthful status

As of this dossier commit:

- source identified: **yes**
- donor behavior understood: **yes, within public evidence**
- portfolio dedupe: **yes**
- clean-room boundary: **defined**
- owned specification: **defined**
- implementation: **not yet certified**
- live provider integration: **not yet implemented/certified**
- browser UAT: **not run**
- hosted preview: **not verified**
- production deployment: **not claimed**
