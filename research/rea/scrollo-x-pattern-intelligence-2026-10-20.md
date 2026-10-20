# REA intake — Scrollo-inspired X niche pattern intelligence (2026-10-20)

Status: RESEARCH / SPECIFIED. No vendor code, live X access, licensed API, deployed capability, product-domain ownership, or exact-head implementation certification is claimed.

## 1. Identity and source register

- User-supplied Reddit shortlink: https://www.reddit.com/r/IMadeThis/s/uTogR9jQZq
- Canonical post: https://www.reddit.com/r/IMadeThis/comments/1xath99/
- Public author: u/ballinhardjustlike
- Observed title: I built a tool that shows the most viral X posts in every niche, then helps you create you own.
- Reddit image alt: demonstration of the Scrollo platform showcasing trending topics and AI-generated content creation.
- Visible discussion: another user asks for access/link; the accessible post does not give a product URL.
- Evidence snapshot date: 2026-10-20. Revalidate dynamic discussion before representing it as complete.

### Evidence levels

| Claim | Evidence class | Status |
| --- | --- | --- |
| A Reddit demo claims niche-based popular X-post discovery plus creation help | public post title + image alt | OBSERVED CLAIM/DEMO |
| Tool is labeled Scrollo | image alt | PUBLIC LABEL |
| Real production app URL, authorship of any domain, product availability | no verified link | UNKNOWN |
| Engagement accuracy / source rights / matching algorithm | no primary technical evidence | UNKNOWN |
| Original GitHub repo, LICENSE, model prompts, data vendor / API | not linked or verified | UNKNOWN |
| getscrollo.com / named Chrome extension is this very product | name overlap only | NOT ESTABLISHED |

Do not substitute a similarly named TikTok/Instagram planner, Chrome extension, gaming app, or unrelated GitHub repo. Do not reverse-engineer protected access controls or copy proprietary UI/assets/implementation.

## 2. Product-oriented reconstruction (hypotheses, not observations)

The minimal observable journey is: choose niche -> find popular X posts -> derive drafting inspiration. Everything below is an independent proposed implementation, not a claim about Scrollo internals.

| Capability | Known donor signal | Owned Creator Console contract | Priority |
| --- | --- | --- | --- |
| Niche discovery | post title says every niche | saved project topic + input query + transparent time window | P0 |
| Source posts | popular X posts claimed | authorized, bounded read adapter; source ID, permalink, retrieval timestamp, coverage | P0 |
| Virality | word viral in launch title | explainable normalized engagement *signal*, data confidence and eligibility gates | P0 |
| Pattern extraction | creation assistance claimed | extract non-verbatim hook/structure categories; citation links | P0 |
| Draft ideas | assisted content creation claimed | multiple original angles; claim/source ledger; editable Content Brief | P0 |
| Creation/publish | no live integration verified | existing Creator Console review and explicit approval pathways | P1 |
| Performance learning | not demonstrated | compare opted-in first-party outcomes, preserve prior versions | P2 |

## 3. Existing-owned capabilities and placement

Canonical repository: https://github.com/rrahul0904/faceless-content-creator . Existing README describes media/templates/rendering, durable jobs, brand assets, review/publishing, quotas and workspace scoping. Existing issues: #21 Creator Data Service durable hosted proof gate; #22 long-form repurposing provenance; #15 approval-gated publishing; #37 security advisory release gate.

Governance: https://github.com/rrahul0904/agent-work-os/issues/343 . Product issue: https://github.com/rrahul0904/faceless-content-creator/issues/38 . Classification: DONOR / CAPABILITY EXTENSION, not a new repo. live-content-intelligence concerns Twitch stream moments rather than social-text topic research.

## 4. Proposed clean-room data and computation contracts

### SourceEvidence object

- Identity: workspaceId, provider=x, sourcePostId, canonicalPermalink, authorHandle or scoped source ID.
- Time: postedAt, observedAt, ingestedAt, queryWindowStart, queryWindowEnd, provider metric sample timestamp.
- Metrics as *available and attributed*: likes, replies, reposts, quotes, views/impressions, follower count. Every metric records its source and null for unavailable values; NEVER default unknown to 0.
- Discovery: user-provided topic/niche, query, provider response digest, pagination status, collection coverage, versioned adapter identity.
- Governance: source access basis, rights/retention policy, deleted/hidden marker, tenant boundary, URL safety, no unnecessary personal data.
- Derived: eligibility, warnings, normalized signal, confidence/coverage and formula version; do not call the result objectively viral or promise engagement.

### Replay ranking v0 (proposal, not a production formula)

1. Pin an as-of timestamp. Compare posts only inside the same explicit niche and lookback window.
2. Exact-deduplicate by sourcePostId and record cross-post or repost references. Retain provider observability receipts.
3. Reject or label items with missing view denominators, too few observed exposures, stale/removed posts, suspicious signals or unknown read permission.
4. Use a transparent engagement-per-impression metric with a sample-size floor and recency/coverage explanation; avoid rewarding only absolute audience size.
5. Return observed components and reason codes instead of a fictional proprietary virality score.
6. Deterministic tie-breakers, immutable fixture corpus and replay version ensure auditability.
7. Account for manipulation, paid amplification, language, geography, bot-like activity and survivor bias; inability to detect is a confidence warning.

### PatternCard and ContentBrief boundary

PatternCard contains source permalink, observedAt, niche, structural pattern labels (e.g., counterintuitive comparison, numbered checklist), normalized-signal components, confidence and source rights, **not a copied viral post**. It generates independently drafted candidate angles that must be rewritten, fact-checked and tied to authoritative technical references before publishing. Model responses are suggestions, not evidence. Existing Content Brief identifiers/versioning must be reused.

## 5. Threat model and guardrails

- Read source through permitted licensed APIs or user-supplied content; no auth bypass, no unapproved browser automation/scraping, no redistribution of post bodies.
- Follow X developer terms, applicable display/storage/retention restrictions, rate limits and deletion propagation; product operations gated on entitlement verification.
- External source content is untrusted prompt-injection material: data-only parsing, schema validation, no tool calls/actions based on included instructions.
- Protect creator account tokens in a credential broker; never export to model, logs or static client bundles.
- Anti-plagiarism: compare proposed outputs against reference excerpts where lawfully held, avoid cloning original hooks/text, require editorial check.
- No mass publishing, unsolicited replies, fake likes, metrics fabrication or account actions; the human approves each publication.
- Degrade gracefully to local fixtures or import-only when upstream data is unavailable; mark synthetic data conspicuously.
- Keep source, claim, review, approval and run receipts with workspace isolation and data erasure path.

## 6. Acceptance, negative tests and proof

| ID | Required test / evidence | Gate |
| --- | --- | --- |
| P0-01 | Synthetic fixture set across 3 niches, 2 time windows, high/low follower authors with known metrics | local replay |
| P0-02 | Deterministic rank and reason codes; same fixture + version -> same output | test |
| P0-03 | Dedup, quoted/reposted, deleted and missing metrics excluded/labeled correctly | test |
| P0-04 | Every pattern card has source identity, permalink and observedAt; synthetic records clearly labeled | test |
| P0-05 | Draft uses pattern labels, not copied passage, and preserves independent factual claim provenance | test/editor |
| P0-06 | Untrusted post attempts to issue publish/API commands -> no side effect | adversarial test |
| P1-01 | Without X entitlement/credentials, live adapter fails closed with readable remediation | connector test |
| P1-02 | Authorized small-sample X read matches provider receipts and respects rate/deletion policy | provider receipt |
| P1-03 | Save Content Brief through real durable Creator Data Service; restart/recover source evidence | blocked by #21 |
| P1-04 | Explicit creator approval needed for scheduling/publishing; revoked token and retry tests | end-to-end |
| RELEASE | Audit, lint, typecheck, replay, service E2E, preview/browser and exact SHA receipts | #37 plus deploy gate |

## 7. Roadmap / status

- R0 CAPTURE: source link, author, public claim, brand-name collision risk. DONE 2026-10-20.
- R1 SPECIFY: product map, clean-room schema, risk/rights gates, test matrix. DRAFT / FOR REVIEW.
- R2 PROVE: local deterministic fixture harness + negative tests; **no live X connector**. NOT STARTED.
- R3 INTEGRATE: Creator Console UI and Content Brief conversion, conditional on durable #21. BLOCKED.
- R4 CONNECT: provider-approved X read adapter; credentials, cost, terms and limits review. BLOCKED / NOT VERIFIED.
- R5 SHIP: CI + durable hosted recovery + human-approved publish tests + exact-SHA deployment receipts. NOT STARTED.

## 8. Open questions

1. Can the Reddit creator provide an official product URL, read-only trial or technical docs?
2. Which X data endpoint/provider is legally and commercially acceptable for the target customer plans?
3. What metrics are actually available and permitted to persist or display?
4. Is the first product slice X-only (recommended) before optional LinkedIn/Reddit patterns?
5. Which Creator Console deployment can host durable evidence and respect provider deletion requests?

## 9. Completion language

This artifact is an evidence-constrained REA dossier. It is not a Scrollo clone, an inspected upstream source repository, a licensed X integration, a tested product feature, or a deployed Creator Console. Keep these statuses separate in tracking and PR review.
