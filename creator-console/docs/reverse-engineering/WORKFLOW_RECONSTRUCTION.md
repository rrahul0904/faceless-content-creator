# Creator Console Workflow Reconstruction v1

This document reconstructs the user job from evidence before UI decisions.

## Primary job

A technical practitioner wants to consistently publish useful, credible content without becoming a full-time content marketer and without sounding like generic AI.

The job is not `write a LinkedIn post`.

The job is:

`notice something worth teaching → understand it → form a point of view → assemble proof → create a useful artifact → adapt it by channel → review → publish → learn what resonated → reuse the learning`

## Actor

Primary actor: technical practitioner / architect / engineer building authority through evidence-backed educational content.

Secondary actors:
- reviewer/approver (optional)
- audience reader
- publishing platform
- evidence/source provider

## State model

### S0 — Inbox / discovery
Inputs:
- official product/release/engineering sources
- Reddit/community discussions
- LinkedIn creator references
- manually saved URLs, PDFs, screenshots, notes
- prior successful content

Required behavior:
- normalize source
- preserve original URL
- classify evidence class
- attach user note/reaction if available
- deduplicate
- do not promote unresolved/secondary material to factual evidence

Exit condition:
- item is either discarded, saved for later, or promoted to a Content Brief.

### S1 — Content Brief
A Content Brief is the durable unit of work.

Minimum fields:
- topic / working title
- trigger: why now / why this was saved
- target audience
- intended teaching outcome
- creator take / hypothesis
- evidence packet
- reference patterns (style-only)
- candidate formats
- status

Exit condition:
- brief has enough evidence and a clear teaching outcome to research deeply.

### S2 — Research / understanding
Required behavior:
- collect primary sources first
- extract atomic claims
- distinguish fact vs inference vs opinion
- surface contradictions and uncertainty
- identify architecture, implementation mechanics, costs, constraints and failure modes when applicable
- collect useful community objections/questions separately

Outputs:
- claim ledger
- source list
- evidence confidence
- unresolved questions
- technical notes

Exit condition:
- evidence gate passes or brief remains blocked.

### S3 — Point of view
Modes:
- factual explainer: creator take optional
- analysis/comparison/opinion: creator take required
- experience story: author-owned evidence required
- tutorial/implementation: runnable or verifiable example required when claims depend on implementation

Required behavior:
- ask for the non-obvious lesson, disagreement, trade-off, or recommendation
- never infer personal experience from reference material

Exit condition:
- explicit thesis exists.

### S4 — Artifact plan
The system decides the best artifact form before writing prose.

Possible artifacts:
- LinkedIn text post
- LinkedIn document/carousel brief
- architecture/data-flow diagram brief
- code/example block
- comparison table
- Medium article
- multi-part series

Required behavior:
- choose based on information shape, not a fixed template
- broad taxonomies may become a series rather than one overloaded post
- architecture/comparison subjects should prefer diagrams/tables where useful

### S5 — Draft
Required behavior:
- generate from evidence + creator take + audience + artifact plan
- channel-native writing, not one draft truncated into multiple platforms
- citations/sources stay linked to supported claims
- no invented first-person claims

### S6 — Critique / revision
Critic dimensions:
- factual support
- creator specificity
- generic-AI pattern risk
- clarity
- technical depth
- information density
- unsupported certainty
- usefulness
- channel fit
- similarity to reference creators

Failure behavior:
- evidence failure returns to S2
- perspective failure returns to S3
- structural failure returns to S4
- prose quality failure loops inside S5/S6 with bounded revisions

### S7 — Approval
Approval is content-bound.

Required behavior:
- show exact publishable artifact
- show evidence and warnings
- approval cannot silently mutate content
- publish requires explicit approval

### S8 — Publish / export
Channel behavior differs:
- LinkedIn direct publishing only when account/API permissions are connected
- Medium uses the actually supported workflow; do not claim API automation that is unavailable
- preserve publication receipt and exact content hash

### S9 — Learn
Inputs:
- impressions/reach when available
- reactions/comments/shares
- engagement rate
- saves/clicks where available
- user qualitative judgment
- topic, hook, format, evidence depth, visual type, posting time

Required behavior:
- compare similar posts
- distinguish correlation from causation
- generate next-action hypotheses rather than pretending analytics prove why something worked
- update reusable creator memory only with traceable evidence

### S10 — Reuse
Possible actions:
- update an older technical post when product behavior changes
- turn a high-performing post into a deeper article
- turn a broad guide into a series
- create a comparison follow-up
- reuse a successful information structure without copying wording

## Core workflow

```text
Discovery / Capture
        ↓
Content Brief
        ↓
Research + Claim Ledger
        ↓
Evidence Gate
   ┌────┴─────┐
 blocked     pass
   │           ↓
more research Creator POV / Thesis
               ↓
          Artifact Plan
               ↓
             Draft
               ↓
          Critic / Revise
               ↓
          Exact Approval
               ↓
        Publish / Export
               ↓
        Metrics + Feedback
               ↓
       Learning / Repurpose
```

## Key failure modes to design against

1. Blank prompt paralysis.
2. Generic AI voice despite technically correct prose.
3. Copy/paste between research and writing tools.
4. Source links without claim-level support.
5. Secondary creator posts accidentally treated as factual evidence.
6. One-size-fits-all template output.
7. Text-only output for inherently visual technical topics.
8. Publishing before exact approval.
9. Analytics dashboards that report numbers but do not change the next decision.
10. Memory that silently turns inference into author-owned fact.

## UI implication

The existing Today/Research/Create navigation may survive, but the clean-room model implies the main object should be the `Content Brief`. UI should be evaluated against state transitions above, not preserved merely because it already exists.
