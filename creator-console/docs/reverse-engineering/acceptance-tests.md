# Behavior Contracts / Acceptance Tests v0.1

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

## Understanding

### AC-U01 — Capture is not understanding
Given only URL metadata/headline text, the record may enter `CAPTURED` but cannot become `EVIDENCE_READY` unless the underlying source was read or a verified primary source supplies the claim.

### AC-U02 — Underlying source must be followed when present
Given a creator/practitioner post that cites first-party docs/release notes/repo, the understanding stage must prefer/follow the first-party source for factual claims.

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

## Artifacts

### AC-R01 — Artifact provenance is inspectable
Any generated code/diagram/benchmark/checklist that appears in approved content must have an `ArtifactReceipt` containing its type, inputs/source IDs and verification status.

### AC-R02 — Unverified artifact cannot be presented as tested
Generated code or benchmark output without execution/evaluation proof must be labeled illustrative/unverified.

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
6. the result is a structured receipt suitable for later drafting — without requiring a language-model credential.
