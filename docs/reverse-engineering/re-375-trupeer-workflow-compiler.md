# RE-375 — Trupeer-inspired workflow-to-training-content compiler

Status: Phase A implementation started; clean-room donor; not deployed; parity not claimed.

Issue: #23

## Source boundary

Starting intake source: https://lnkd.in/p/g_wPWsTZ

Public product behavior was cross-checked against Trupeer's public Video, Documentation, Knowledge Base, Pricing, release, security/trust, and public review surfaces on 2026-10-07.

This repository does **not** copy Trupeer source code, prompts, branding, private application behavior, proprietary templates, or paid content. The implementation is independently authored around generic workflow-compilation contracts.

## Why this is consolidated here

Faceless Content Creator already owns the downstream media primitives required for this category: versioned templates, semantic timing, FFmpeg rendering, narration/subtitles, brand assets, durable render jobs, workspace controls, usage accounting, and an optional AI-presenter service boundary.

RE-375 therefore adds the missing process layer instead of creating a duplicate standalone product.

## Product thesis

The source of truth is a revisioned workflow graph, not a rendered video.

```text
WorkflowCapture
  + events
  + transcript
  + visual evidence
        |
        v
WorkflowRevision
        |
        v
     StepGraph
      /    \
     v      v
GuideDocument  VideoPlan
        |
        +--> later: ProcessFlow / KnowledgeChunks / LocalizationVariants
```

Generated artifacts must remain attributable to exact workflow steps and evidence ranges.

## Phase A contracts

The first implementation slice introduces:

- `WorkflowCapture`
- `WorkflowEvent`
- `VisualEvidenceRef`
- `TranscriptSegment`
- `WorkflowRevision`
- `WorkflowStep`
- `StepGraph`
- `GuideDocument`
- `VideoPlan`
- `WorkflowRevisionDiff`
- `CostEstimate`
- `ReviewState`

Phase A is deliberately deterministic and provider-free. It accepts fixture/event input rather than pretending a browser recorder or live AI provider already exists.

## Invariants

1. Input ordering is normalized before compilation.
2. Revisions are immutable and content-addressed.
3. Steps preserve source event IDs, evidence references, timing and review state.
4. Sensitive source events/evidence propagate `BLOCKED_REVIEW`.
5. Cross-workspace access/diff operations fail closed.
6. Revision diff classifies unchanged, added, modified and removed steps.
7. Diff output identifies the guide/video artifacts affected by changed steps.
8. Cost estimation is a separate preflight contract and reports unknown rates explicitly rather than inventing a number.
9. Publishing must be gated by review state.
10. Existing render behavior remains separate until the compiler is independently verified.

## Differentiators to prove

### Revision-aware regeneration

A workflow change should not force an indiscriminate full rebuild. The compiler must identify the affected step/artifact dependency set so downstream adapters can reuse unaffected outputs.

### Cost preflight

Provider-backed generation must be preceded by an inspectable estimate for requested video/document/translation/avatar operations. Unknown pricing must remain `unknown`.

### Evidence lineage

Guide sections, scenes and later search chunks must preserve source step and evidence references. Search results should eventually return the represented workflow revision and timestamp/source anchors.

### Staleness and review

Published material needs a revision identity. When a newer workflow revision changes a represented step, older derived content can be marked stale. Sensitive and localized material can require approval before publish.

## Phase A acceptance gate

Before this slice can be called verified:

- deterministic fixtures and negative cases must exist;
- revision diff / partial invalidation must be tested;
- workspace isolation must be tested;
- sensitive review propagation and publish blocking must be tested;
- cost-preflight behavior must be tested;
- repository-wide lint/typecheck/build and existing media smoke paths must remain green;
- exact branch/SHA/CI evidence must be recorded in Issue #23 and the canonical tracker.

Until then, status remains **BUILDING**, not shipped.

## Later phases

- Phase B: browser/screen capture adapter, STT, screenshot extraction/annotation, bind `VideoPlan` to the existing renderer, Markdown/HTML guide export.
- Phase C: localization variants, glossary/do-not-translate terms, screenshot/on-screen-text review and per-language approval.
- Phase D: revision-aware knowledge indexing/search with source/timestamp citations and stale-content detection.
- Phase E: approvals/version history/audit receipts and governed knowledge connector/MCP integration.

## Explicit non-goals for the first release

- LMS quizzes/completion tracking
- sales-only interactive demo builder
- deep avatar studio
- broad enterprise integration catalog
- UI cloning
- pricing cloning
- Trupeer parity claims
