# Behavior Contracts / Acceptance Tests v0.3

These contracts come from the reverse-engineering evidence and product thesis. They are not implementation-specific UI tests.

## Source and evidence

### AC-E01 — Style/reference evidence cannot support factual claims
Given a source classified as `structural-reference` or `community-feedback`, when a factual technical claim is assembled, then that source alone must not satisfy the evidence gate.

### AC-E02 — Production claims must preserve source semantics
Given an official source that explicitly describes code as a tutorial/reference implementation, when content recommends it, then the content plan/draft must preserve that limitation and must not call it production-ready without additional evidence.

### AC-E03 — Benchmark claims bind conditions
Given a numeric benchmark claim, then the evidence record must contain the source plus available test conditions/context; otherwise the claim remains blocked or is rewritten without the number.

### AC-E04 — Unresolved source remains unresolved
Given a shortlink/page that cannot be resolved or read, then no title, sentiment, workflow or technical conclusion may be inferred from it.

### AC-E05 — Factual claim must match source authority scope
Given a factual clause and a bound source, the source must explicitly qualify for the claim's required authority scope. A creator/practitioner post may prove what that author said, but it does not automatically prove third-party compensation, company-internal process, benchmark, or product claims. A source-class match without authority-scope match fails the evidence gate.

### AC-E06 — Viral hook is decomposed before reuse
Given a hook containing multiple factual clauses (for example compensation + employer + “exact pipeline”), each clause must be evaluated independently. Unsupported clauses must be removed, weakened, attributed, or rebound to qualifying evidence before the hook can enter a draft.

## Understanding

### AC-U01 — Capture is not understanding
Given only URL metadata/headline text, the record may enter `CAPTURED` but cannot become `EVIDENCE_READY` unless the underlying source was read or a verified primary source supplies the claim.

### AC-U02 — Underlying source must be followed when present
Given a creator/practitioner post that cites first-party docs/release notes/repo, the understanding stage must prefer/follow the first-party source for factual claims.

### AC-U03 — Linked official source does not retroactively validate the wrapper post
Given a secondary/creator post linking an official source, claims in the wrapper post remain separately evaluated. The official source can support only claims within its own authority scope; it cannot be used as blanket validation for unrelated wrapper claims.

## Authorship

### AC-A01 — First-person claims require author ownership
Given a draft containing “I”, “we”, “in my experience”, a project/customer outcome, or a creator-specific opinion presented as fact, there must be an `AuthorAssertion` supporting it.

### AC-A02 — Missing judgment fails closed
Given a content plan requiring a strong opinion/trade-off recommendation and no relevant `AuthorAssertion`, then the workflow stops at `BLOCKED_AUTHORSHIP_INSUFFICIENT` or switches to an explicitly neutral explanatory plan.

### AC-A03 — Reference creators cannot become author experience
Given a LinkedIn reference from another creator, its anecdotes/opinions cannot be converted into Rahul's first-person claims.

## Content planning

### AC-P01 — Broad complex domains are not automatically compressed into one post
Given a broad domain with multiple dependency clusters (for example RAG architecture or Data Engineering + GenAI), the planner must evaluate `single`, `series`, and `question-map` candidates and provide a reason for the chosen format.

### AC-P02 — Series plan has prerequisites
Given a `series` content plan, every lesson after the first must declare zero or more prerequisite lesson IDs and the plan must be acyclic.

### AC-P03 — Project-spine series has cumulative milestones
Given a `project-backed-series`, lessons that modify the project must declare a milestone/output, and the final plan must identify the cumulative artifact.

### AC-P04 — Content type drives required proof
Given an architecture teardown, benchmark explanation or implementation walkthrough, the planner must request an appropriate artifact/evidence type instead of treating text-only output as automatically sufficient.

### AC-P05 — Deep source may expand into a series instead of a compressed hook
Given a source whose underlying material spans multiple major competency clusters, the planner must evaluate whether a series/question-map/project-backed path is more faithful than compressing the source into one short post.

## Artifacts

### AC-R01 — Artifact provenance is inspectable
Any generated code/diagram/benchmark/checklist that appears in approved content must have an `ArtifactReceipt` containing its type, inputs/source IDs and verification status.

### AC-R02 — Unverified artifact cannot be presented as tested
Generated code or benchmark output without execution/evaluation proof must be labeled illustrative/unverified.

### AC-R03 — Technical visuals are explanatory artifacts, not decoration
Given a topic whose key value is an architecture/configuration/product change, the visual planner must produce a structured explainer brief with at least: central claim, prior state/problem, changed mechanism or artifact, resulting state/outcome, and evidence-backed takeaways. A generic decorative-image prompt does not satisfy this contract.

### AC-R04 — Visual factual labels are provenance-bound
Given a visual containing a release state, product capability, benchmark number, architecture label or comparison claim, each factual label must bind to evidence IDs. Observed layout/style evidence alone cannot satisfy factual support.

### AC-R05 — Code/config shown in a visual must be semantically relevant
Given a visual that includes code, SQL, YAML, JSON or configuration, the snippet must be derived from or validated against the supporting source/implementation contract and must materially explain the mechanism. Placeholder code added only for aesthetics fails review.

### AC-R06 — Clean-room visual reconstruction
Given an external visual used as reverse-engineering evidence, the resulting Creator Console artifact may reuse the explanatory grammar (for example before/after, mechanism, result) but must not reproduce protected brand artwork, exact copy, icons, layout geometry or distinctive visual styling.

## Draft/review

### AC-D01 — Draft source set is explicit
Every draft receipt records exact evidence IDs, author assertion IDs, content-plan ID and artifact IDs used.

### AC-D02 — Critic checks technical shallowness
A review must be able to fail a draft that merely restates an announcement without explaining mechanics, architecture, trade-offs, evidence or practical implication required by its plan.

### AC-D03 — Structural references cannot be copied
Reference material may influence structure but phrase-level similarity above the configured threshold fails review.

## Approval and publishing

### AC-G01 — Approval binds the whole publication package
An approval receipt must bind exact draft content plus evidence IDs, author assertion IDs and artifact hashes/IDs.

### AC-G02 — Post-approval mutation invalidates approval
Any change to approved content or bound artifacts/evidence invalidates the approval used for publishing.

### AC-G03 — Publishing always requires explicit approval
No scheduler/publisher endpoint may infer approval from quality pass or draft existence.

## Learning

### AC-L01 — No fabricated performance data
If publication/analytics data is unavailable, the learning loop must report it unavailable rather than synthesize impressions, engagement or dwell-time values.

### AC-L02 — Learning is multi-dimensional
A recommendation based on past performance must identify the observed dimensions used (topic, content type, artifact type, depth, hook, evidence density, series position, etc.); it must not simply clone the top-impression post.

## Vertical Slice 1 exit criteria

The first reset implementation may be considered verified only when it can deterministically demonstrate:

1. a source record moves through `CAPTURED` → `UNDERSTANDING` → `EVIDENCE_READY` when sufficient evidence exists;
2. a style/reference-only source fails the factual evidence gate;
3. missing creator judgment produces `BLOCKED_AUTHORSHIP_INSUFFICIENT` for an opinionated plan;
4. a broad multi-cluster topic can produce a dependency-safe `series` recommendation;
5. a tutorial/reference source carries its semantic warning into the output plan;
6. a first-party-public creator post cannot support a factual claim outside its declared authority scope;
7. an official source can support a claim within its declared authority scope;
8. the result is a structured receipt suitable for later drafting — without requiring a language-model credential.

## Vertical Slice 2 candidate exit criteria — proof-bearing visual explainer

This slice must not start until the visual-planning hypothesis is accepted by the tracker. If accepted, it must demonstrate:

1. architecture/product-change topics can request a `visual-explainer` artifact;
2. the brief contains prior state, mechanism/config, resulting state and takeaways;
3. every factual visual label maps to evidence IDs;
4. code/config snippets are source-grounded or explicitly illustrative;
5. external reference visuals influence explanatory structure only, not copied design;
6. the resulting artifact receipt can be bound into draft review and approval.
