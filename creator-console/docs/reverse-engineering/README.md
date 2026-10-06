# Creator Console — Reverse-Engineering Reset

Status: **RESEARCH / RECONSTRUCTION IN PROGRESS**

The existing `creator-console/` application is treated as **prototype/donor code**, not proof that the target product has been understood or recreated.

## Mandatory roadmap

No feature is considered justified merely because it exists in the prototype. Work must proceed in this order:

1. Source identification
2. Evidence collection
3. Product/user workflow reconstruction
4. Capability and failure-mode decomposition
5. User feedback and pain-point analysis
6. Competitive comparison
7. Audit of existing internal donor code
8. Product thesis and target boundary
9. Behavior contracts and acceptance tests
10. Feature implementation
11. Independent verification
12. Hosted/browser/recovery certification
13. Tracker update based only on evidence

## Evidence classes

Every factual claim in the reverse-engineering record must be one of:

- `official-doc` — official documentation, API reference, pricing, changelog, status or release notes.
- `official-source` — official open-source implementation, SDK, CLI or repository.
- `first-party-public` — creator/company post, launch note, engineering write-up, interview or public statement from the source itself.
- `observed-ui` — directly observed behavior from a public or authenticated product surface.
- `community-feedback` — Reddit, comments, reviews, discussions or practitioner reports; useful for pain points, not treated as authoritative product facts.
- `inference` — analyst interpretation derived from evidence; must never be presented as an observed fact.

## Current truth

The current prototype already contains potentially reusable donor components:

- official-source discovery and primary-page enrichment
- deterministic editorial ranking
- evidence gating
- creator-context retrieval
- writer / critic / revision harness contracts
- exact-content approval receipts
- LinkedIn publishing adapter
- Medium export adapter
- draft/profile persistence contracts

These components are **not yet accepted into the reconstructed product**. Each must survive the capability matrix and behavior-contract stages.

## Required artifacts before another major UI redesign

- `source-corpus.md`
- `evidence-ledger.md`
- `workflow-reconstruction.md`
- `feedback-matrix.md`
- `competitive-matrix.md`
- `capability-matrix.md`
- `donor-audit.md`
- `product-thesis.md`
- `acceptance-tests.md`
- `tracker.md`

## Definition of "reverse engineered"

A capability is not reverse engineered because we copied a screen, tagged a LinkedIn post, or implemented a plausible feature. It is reverse engineered only when we can show:

**source evidence → observable behavior/user need → reconstructed workflow → explicit product decision → acceptance criteria → implementation → runtime proof.**

Until that chain exists, the capability remains `INVESTIGATE` or `PROTOTYPE`.
