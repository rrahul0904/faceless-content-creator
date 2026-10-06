# Creator Console Reverse-Engineering Roadmap Contract

Status: ACTIVE
Branch: `creator-console/reverse-engineering-reset-v1`

The existing Creator Console implementation is donor code and must not be described as a completed reverse-engineered product until the gates below are satisfied with evidence.

## Mandatory order

1. Source identification
2. Evidence collection
3. User/job/workflow reconstruction
4. Capability and failure-mode decomposition
5. User feedback and pain-point analysis
6. Competitive comparison
7. Audit of existing Creator Console donor code
8. Product thesis and target boundary
9. Clean-room behavior contracts and acceptance tests
10. Feature implementation
11. Independent verification
12. Hosted/browser/recovery certification
13. Tracker update based only on evidence

Implementation may reuse donor code only after a source-derived behavior contract exists for the capability being reused.

## Evidence classes

Every material product claim must be tagged as one of:

- `official-doc` — official documentation, help center, API reference, pricing, changelog.
- `official-source` — first-party source code, SDK, CLI, repository.
- `first-party-public` — first-party site, launch page, engineering post, founder statement.
- `observed-ui` — directly observed public UI behavior.
- `community` — Reddit or other user discussion; useful for pain points and sentiment, never authoritative for product facts.
- `reference-pattern` — creator post used to learn structure or presentation; never factual evidence by itself.
- `inference` — a reasoned conclusion derived from evidence and explicitly marked as such.

## Gate rules

### Gate 1 — Source corpus
Must contain identifiable products, creator references, official docs and community feedback. Short links that cannot be resolved remain unresolved and cannot support behavioral claims.

### Gate 2 — Evidence ledger
Each meaningful claim records: source, evidence class, observed behavior, user value/pain, confidence, and product implication.

### Gate 3 — Workflow reconstruction
Must describe the end-to-end job in state transitions, not screen names alone.

### Gate 4 — Capability matrix
Every candidate capability is classified as `MATCH`, `IMPROVE`, `NEW`, `OMIT`, or `INVESTIGATE` with evidence.

### Gate 5 — Product thesis
The product must answer why it deserves to exist when users already have ChatGPT/Claude, Perplexity, Kleo, Taplio, AuthoredUp and native LinkedIn.

### Gate 6 — Behavior contracts
No feature is considered implementation-ready without inputs, states, outputs, failure behavior and acceptance criteria.

### Gate 7 — Verification
Passing unit tests alone is insufficient. Verification must include hosted behavior, browser workflow, negative cases, recovery behavior and exact deployment SHA.

## Truthfulness rules

- Do not call a capability complete if it is scaffold-only.
- Do not promote a community claim to fact without a primary/official source.
- Do not treat creator wording as user identity, experience or expertise.
- Do not manufacture analytics, benchmarks, hands-on experience or publication results.
- Do not mark a roadmap phase complete because code exists; evidence and acceptance behavior are required.

## Current assessment

The pre-reset Creator Console has useful donor infrastructure: official-source discovery, evidence gating, context retrieval, writer/critic harness contracts, signed approvals, publishing adapters, UI scaffolding and persistence schema. It does not yet have a source-derived clean-room product model, a complete feedback matrix, comparative UAT or evidence-backed tracker closure. Therefore its status is `prototype-donor`, not `reverse-engineering-complete`.
