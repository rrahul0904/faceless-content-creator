# Creator Console Clean-Room Product Spec v1

Status: implementation-ready for Slice A only. Later slices remain gated by evidence and acceptance criteria.

## Product thesis

Creator Console is a technical creator operating system for practitioners who want to teach what they know without becoming generic AI content producers.

It converts trustworthy technical research plus the creator's own judgment into evidence-backed content artifacts, publishes them through explicit approval, and learns from real performance without inventing causality.

## Non-goals for v1

- generic social-media management
- automated engagement/comment bots
- CRM/outreach
- unsupported Medium automation
- fake analytics
- copying creator reference wording
- inventing personal experience

## Core domain objects

### ContentBrief

Required:
- `id`
- `topic`
- `status`
- `createdAt`
- `updatedAt`

Optional / progressive:
- `trigger` — why the subject entered the system
- `audience`
- `teachingOutcome`
- `creatorTake`
- `mode` — `factual-explainer | analysis | comparison | tutorial | experience | series`
- `sourceIds[]`
- `claimIds[]`
- `referencePatternIds[]`
- `artifactPlan`
- `platforms[]`
- `warnings[]`

States:
`captured → researching → evidence-ready → perspective-ready → planned → drafting → review → approval-required → approved → scheduled/published/exported → learning`

Blocked states:
`blocked-evidence | blocked-perspective | blocked-verification | blocked-publisher`

### SourceRecord

Fields:
- `id`
- `url`
- `canonicalUrl`
- `evidenceClass`
- `title`
- `publisher/creator`
- `publishedAt`
- `capturedAt`
- `snapshotHash`
- `userNote`
- `resolutionStatus`

Rules:
- unresolved shortlinks cannot support claims
- reference-pattern sources cannot support factual claims without a separate evidence source
- community sources may support pain/sentiment/questions, not authoritative product facts

### Claim

Fields:
- `id`
- `briefId`
- `text`
- `claimType` — `fact | inference | creator-opinion | author-experience`
- `supportingSourceIds[]`
- `confidence`
- `status` — `supported | disputed | unresolved | unsupported`
- `caveat`

Rules:
- `fact` requires at least one evidence-capable source
- `author-experience` requires author-owned evidence or explicit user input
- disputed/unresolved claims cannot be silently converted to certainty

### ArtifactPlan

Fields:
- `primaryFormat`
- `secondaryFormats[]`
- `reason`
- `visualNeeded`
- `visualType`
- `seriesPlan[]`
- `platformConstraints`

Allowed formats for v1:
- `linkedin-text`
- `linkedin-document-brief`
- `technical-diagram-brief`
- `comparison-table`
- `code-example`
- `medium-article`
- `series`

### DraftVersion

Fields:
- `briefId`
- `platform`
- `version`
- `content`
- `artifactMetadata`
- `claimMap`
- `criticResult`
- `createdAt`

### ApprovalReceipt

Must bind:
- exact draft hash
- platform
- run/brief id
- timestamp / expiry if applicable

### PublicationReceipt

Must bind:
- approved draft hash
- platform
- external id/url when available
- publication timestamp

### LearningHypothesis

Fields:
- `briefId/publicationId`
- `observation`
- `hypothesis`
- `supportingMetrics`
- `confidence`
- `recommendedNextAction`

Rule: analytics may suggest hypotheses; it cannot claim causal explanation from simple correlation.

## Slice A — Persistent Content Brief + claim/evidence model

### Goal

Replace the hidden assumption that a research card immediately becomes a post. Introduce the durable work object that all later research, generation and publishing must attach to.

### Inputs

- official-source discovery item OR
- manually captured URL/note OR
- unresolved/community/reference item

### Behavior

1. User/system creates a Content Brief from a source.
2. Source is preserved with evidence class and resolution status.
3. Brief stores trigger and teaching outcome independently from source text.
4. Creator take may be empty during research.
5. Claims attach separately from source records.
6. Evidence gate calculates readiness from claims, not from a generic source-level `evidence ready` boolean.
7. Brief cannot enter drafting when required claims are unsupported.

### Acceptance criteria

A1. Creating a brief from a primary official source produces `captured` or `researching`, never `approved`/`drafting`.

A2. Creating a brief from a LinkedIn reference stores it as `reference-pattern`; it does not satisfy factual claim support.

A3. Creating a brief from unresolved Reddit/LinkedIn shortlink records the source but keeps claim support unavailable.

A4. A factual claim with no evidence-capable source is `unsupported` and blocks evidence readiness.

A5. A creator-opinion claim does not require external factual support, but any factual premise embedded in it must be separate claims.

A6. Experience mode requires explicit author-owned input/evidence; reference posts cannot create it.

A7. Every transition is validated; impossible transitions fail closed.

A8. Serialization is deterministic enough for receipt hashing/replay comparisons.

## Slice B — Research workbench

Gated until Slice A passes.

Target:
- source inbox
- claim ledger
- primary-source search/enrichment
- community questions separated from facts
- contradiction/unresolved panel
- teaching outcome + creator take

## Slice C — Artifact planner

Gated until research workbench UAT.

Target:
- choose text vs diagram vs table vs code vs series
- explain why format was selected
- allow user override
- prevent one-size-fits-all post templates

## Slice D — Evidence-backed drafting/editor

Target:
- channel-native LinkedIn + Medium
- in-place editor
- claim inspector
- version history
- writer/critic/revision
- anti-generic-AI checks

## Slice E — Approval, queue, publishing

Target:
- exact draft approval
- calendar/queue
- LinkedIn publish adapter
- truthful Medium workflow
- publication receipts

## Slice F — Analytics and learning

Target:
- real metrics only
- comparable-post analysis
- next-action hypotheses
- repurposing/update recommendations
- no fake causal claims

## UAT definition

A product slice is not complete until:
1. domain tests pass,
2. negative cases pass,
3. hosted API behavior passes,
4. browser workflow passes,
5. recovery/failure behavior passes,
6. exact deployment SHA is recorded,
7. comparison against source-derived acceptance criteria is documented.
