# REA intake: DistribPal-inspired, clean-room campaign planning (2026-10-20)

## Evidence boundary
- User link: https://www.reddit.com/r/AppBuilding/s/UDYXUo0bhu
- Resolved discussion: https://www.reddit.com/r/AppBuilding/comments/1xb9e2s/
- Public product: https://distribpal.com/
- Independent directory recap (2026-10-16): https://coderhype.com/project/distribpal/
- Parent governance: https://github.com/rrahul0904/agent-work-os/issues/347
- Product implementation issue: https://github.com/rrahul0904/faceless-content-creator/issues/40

The author links to DistribPal directly. The public site advertises a local coding-agent-driven toolkit accepting an app URL, conducting ICP research, proposing format-matched 2–7-slide 9:16 social creative, optionally building video and sending batches to Postiz. Page advertises $25 promotion (struck-through $250) paid once, users' own keys/accounts and a commercial one-company licence. **Product source code has not been acquired, opened, or inspected; no upstream source SHA applies.** This is a public-behavior clean-room reconstruction, not a clone of hidden source/prompts/design.

The Reddit author reports $3,448.19 revenue over 44 days; the landing page reports 7.5M+ views from nine accounts across four platforms and $0 ad spend. These are unverified founder figures, not certified sales, attributed signups, independent audience analytics, or proven causation. The Reddit image alt text describes a different cumulative amount as of Oct 9. Preserve these as distinct claims; never combine them. Secondary article (Oct 16) reports earlier $3,000/35-day claim. No guarantee or revenue projection is justified.

## Canonical ownership
**Classification: DONOR / MODULE, not new repository.**
- Primary product: this repository (Creator Console + Visual Story / TemplateDocument + FFmpeg + media queue + platform adapters). Reuse its existing signed human approval code.
- LaunchGrid: product launch/distribution directory intelligence, organic/sponsored distinction, analytics and attribution, not a second slideshow engine.
- Agent Work OS: agent policy, capability permission, evidence/receipt ledger, durable retry/replay, verification and release gates.
- Related Creator Console issues: #15 approval publishing, #21 persistence, #22 sourced content, #31/#32 Visual Story, #37 security, #38 viral-pattern intelligence. #38 discovers lawful patterns; this intake plans original campaign briefs from product/evidence, not a duplicate scraping pipeline.

## MATCH / IMPROVE / NEW / OMIT
- MATCH: supplied product/store link, persona/pain research, simple vertical slideshow storyboard, multi-platform variants, week/month plan proposals, one-command-friendly machine-readable contract.
- IMPROVE: evidence-linked product promises, customer pain explicitly labeled hypothesis, cross-workspace identity isolation, deterministic replay, rights review, truthful plan status, separate render/approve/schedule stages, cancellation/retry receipts and analytics quality.
- NEW: conversion-aware creative experiment design, holdouts, UTM-attributed landing events, attribution uncertainty, content/version signatures, change audit and data deletion semantics.
- OMIT: auto-posting without review, copied external text/creative/audio, fabricated proof, unsanctioned reviews/testimonials, direct follower scraping, fake virality and unaudited sales claims.

## Reconstructed behavior (public-only, architectural hypothesis)
1. Bounded URL metadata intake -> source provenance -> editable ProductBrief with claims.
2. Research-first audience hypothesis cards with traceable complaint data and lawful access.
3. Pattern abstraction from public example's **structure** only, with source rights record. Do not import third-party creative assets/text.
4. Prompt briefs -> original copy proposal -> StoryboardSpec -> existing VisualStorySpec/TemplateDocument editable layers and rendering pipeline.
5. Media/license, accessibility, motion, text safe-area, originality and claim QA -> versioned draft calendar.
6. Human-signed per-asset/version/channel approval -> future Postiz/native provider connector with owner OAuth/scope, provider quotas, idempotency, failure/cancel receipts.
7. Reach -> clicks -> signups -> paid conversion, each independently sourced and with attribution limitations; agent may propose experiments but cannot independently publish.

## Phase A: implemented offline behavior
Module: creator-console/lib/campaign-planner.js.
Tests: creator-console/tests/campaign-planner.test.js.

Input needs workspaceId; Product{name,url,positioning,claims with evidenceId}; first-party/owner evidence URLs; Audience{persona,pains}; owned structural pattern enum; target channels; starting day, number of posts, interval.
Output gives deterministic CampaignPlan + stable SHA-256 plan/receipt IDs, 5-slide 1080x1920 storyboard briefs, per-channel not-rendered target variants, draft dates, mandatory rights/editorial/claim review and hard canPublish=false/canSchedule=false. It does **not** call a model, fetch a page, render an asset, use accounts, contact users, or make external requests. Evidence URLs are metadata claimed by the caller, not independent certification; future read-side ingestion requires DNS/IP/redirect SSRF and consent checks.

Run without provider secrets: cd creator-console && npm test; alternatively node --test creator-console/tests/campaign-planner.test.js.

Proposed bounded tests: deterministic replay; tenant isolation; known platforms; 9:16 dimensions; supported product claims only; duplicate evidence rejection; unsafe host/credentials rejection; invalid schedule dates and batch limits; no publish authority. Source-claim truth and copyrights still need independent reviewer judgment.

## Definition-of-done and exact gates
- [x] Verify Reddit link -> author -> official product; evidence/claims matrix.
- [x] Proprietary/commercial source classification; clean-room ownership.
- [x] Offline, fixture-only spec/contract + authored negative tests committed to a research branch; run/CI evidence must be checked separately.
- [ ] Integrate actual read-only product intake with live-source provenance, approval, redirect/DNS/SSRF handling, and durable data tenancy.
- [ ] Integrate audience/review research respecting website/API terms and privacy. Preserve provenance and rights, no direct scrape of private profiles.
- [ ] Storyboard -> existing editable studio and real PNG/MP4, image/audio licenses, visual QA across 4 aspect/platform acceptance suites.
- [ ] Full sign-off with existing publisher signer and new per-channel/media/content approval; retries/idempotency/cancellation/webhook status with Postiz or native official platform APIs. No live provider write prior to gate.
- [ ] Real permitted data; controllable budget, media costs and quotas; analytics with actual attribution and experiments.
- [ ] Resolve repository security audit blocker #37 and hosted persistence #21; exact-head CI, independent browser UAT, full trusted runtime, preview and separately approved production deploy.
- [ ] Classify provenance, test results, merge state, preview, UAT and SHIPPED separately in tracker; no parity or production claim.

## Dependencies and legal boundaries
DistribPal: sales page explicitly says commercial one-company license; not open-source. Do not purchase, download, copy source, reuse branding, prompts, screenshots or media assets. A similar slideshow shape is a generic product capability only.

Postiz: https://postiz.com and https://docs.postiz.com/public-api ; separate third-party scheduling provider. Its self-hosted source is AGPL-3.0 (https://github.com/gitroomhq/postiz-app/blob/main/LICENSE), while API use is separately governed by provider terms, credentials, and platform permissions. This module imports no Postiz code; future optional adapter may use documented, consented API without introducing AGPL source into this repository.

Image generation, audio, social networks and any purchase/payment integration carry separate terms/rights/costs. Do not assume 'free Gemini key' means image calls are always free. Permission for user-owned brands/assets and independent image/music rights review must be recorded.

**Current truth:** first deterministic offline planner slice only; not provider-integrated, not rendering, not revenue-verified, not merged, not deployed, not SHIPPED.
