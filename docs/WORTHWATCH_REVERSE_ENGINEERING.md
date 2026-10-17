# worthwatch reverse-engineering dossier

Status: REA evidence pass 1 complete; routed as donor to existing YouTube Intelligence lane
Parent research: https://github.com/rrahul0904/agent-work-os/issues/264
Implementation issue: https://github.com/rrahul0904/faceless-content-creator/issues/34
Existing YouTube Intelligence issue: https://github.com/rrahul0904/faceless-content-creator/issues/26
Existing BYSO dossier: `docs/BYSO_REVERSE_ENGINEERING.md`
Intake source: https://www.reddit.com/r/coolgithubprojects/s/7hrppoOfdN
Resolved Reddit thread: https://www.reddit.com/r/coolgithubprojects/comments/1x7zkuv/worthwatch_reads_the_new_videos_from_the_youtube/
Upstream: https://github.com/mokshtheverma-max/worthwatch
Exact inspected upstream head: `99c66d223cbe0783251f8cdf6874b207dea74048`
Upstream license: Apache-2.0
Evidence snapshot: 2026-10-17 ET

## 1. Routing decision

worthwatch is a **donor/reference**, not a standalone product to clone.

The owned product boundary is this repository's existing YouTube Intelligence / Creator Console lane. Agent Work OS remains the governance/orchestration/evidence/Shipping layer, while this repository owns the concrete media/YouTube intelligence product implementation.

The capability gap worthwatch closes is narrower and more valuable than cloning the whole tool:

```text
followed channels
  -> discover new videos
  -> acquire transcript evidence
  -> compare with current project context
  -> generate candidate recommendations
  -> deterministic evidence/policy checks
  -> typed verdict
  -> action/idea candidates
  -> periodic digest
  -> Agent Work OS proposal / Creator Console use
```

Do not create a second transcript store, second YouTube ingestion stack, or a new worthwatch product repository.

## 2. What is directly observed

From the Reddit launch post, public README, package metadata, MCP implementation, agent documentation and CI configuration at the pinned upstream SHA:

- configured YouTube channels can be scanned for new videos;
- new videos are judged against a user-maintained project/context file rather than summarized generically;
- verdicts include `YES`, `OPPORTUNITY`, `MAYBE`, and `NO`;
- project standing decisions/rules are checked in deterministic code after model generation;
- quoted spans are validated against transcript evidence;
- daily digests are produced from stored results;
- an idea board stores candidate business/product ideas;
- MCP exposes a narrow stdio tool surface for agent use;
- supported judgment backends include agent mode, Claude Code, Codex CLI, OpenAI-compatible APIs and Ollama;
- project context, channels, records, transcripts and digests remain local by default;
- YouTube access is captions-first and bounded by request gaps, daily limits and cooldown/refusal handling;
- optional audio download/transcription is disabled by default and explicitly called out as potentially conflicting with YouTube terms;
- the launch post says a built-in daily scheduler is planned next, so scheduler support is not treated as an observed shipped capability;
- the Reddit post was new at first capture and no substantive independent comment corpus was visible.

## 3. Evidence classification

### OBSERVED

- local-first CLI/package architecture;
- project-context file used as judging context;
- configured channel list;
- transcript/caption acquisition;
- typed verdicts;
- code-level post-model checks;
- quote-support validation;
- daily digest;
- idea board;
- MCP server and Agent Skill packaging;
- multiple model/backend options;
- bounded YouTube request behavior;
- Apache-2.0 license;
- cross-platform CI.

### CREATOR-REPORTED

The launch post says earlier Reddit feedback exposed a weakness in the first quote-check implementation and that it was fixed with tests. Upstream source at the inspected head contains comments describing the old and new algorithms, but the original external feedback thread was not independently located during this pass.

### DERIVED

For our owned implementation, the useful product abstraction is a **Project Signal Intelligence** layer that turns public-source evidence into project-specific, evidence-backed candidate actions while preserving policy and provenance.

### UNKNOWN

Do not guess:

- worthwatch's real user retention or daily active use;
- quality of relevance verdicts across diverse projects;
- false-positive/false-negative relevance rates;
- average live YouTube acquisition success rate;
- current provider quota/cost behavior in real deployments;
- whether users prefer the idea board or external task/project systems;
- reliability of optional audio transcription in practice;
- future scheduler design;
- future hosted/product UI plans.

## 4. Upstream architecture snapshot

At the pinned SHA, the Python package includes:

- `src/worthwatch/core.py` — large acquisition, state and orchestration module;
- `src/worthwatch/mcpserver.py` — stdio MCP server;
- `src/worthwatch/summaryrules.py` — deterministic summary/verdict/evidence checks;
- `src/worthwatch/scoring.py` — relevance/scoring logic;
- `src/worthwatch/brains.py` — backend/model detection and routing;
- `src/worthwatch/settings.py` — local settings;
- `src/worthwatch/firstrun.py` — initialization;
- `src/worthwatch/jev.py` — optional idea screening integration;
- `tests/` — extensive regression tests;
- `.github/workflows/ci.yml` — cross-platform test matrix.

The package currently reports version `0.1.0` and requires Python 3.11+.

### Model/backend boundary

The upstream `brains.py` exposes five logical modes:

- `agent` — external AI agent through MCP; worthwatch itself calls no model;
- `claude` — Claude Code CLI;
- `codex` — Codex CLI;
- `api` — OpenAI-compatible API providers;
- `ollama` — local Ollama model.

This is useful as a provider-neutral pattern, but our owned implementation should use the platform's existing provider/capability registry rather than reproduce these specific shell/API adapters independently inside this feature.

### MCP boundary

The upstream MCP server explicitly says it will not:

- accept arbitrary non-YouTube input as a video;
- write to arbitrary user-provided paths;
- execute arbitrary commands from tool arguments;
- bypass YouTube limits/refusals by trying alternate paths.

That aligns well with Agent Work OS effect/policy boundaries and should be preserved as a product principle.

### Quote/evidence validation

The upstream summary rules contain a particularly useful engineering lesson.

The prior rule allowed a quotation when enough word pairs occurred somewhere in the transcript. The source comments state that this could incorrectly accept a quote stitched from separate passages. The current implementation instead requires support from **one contiguous transcript stretch**, with a bounded word-difference allowance that grows only for longer quotes.

The reusable principle is:

> evidence for a quotation or recommendation must resolve to a coherent source span, not a bag of matching tokens scattered across the document.

Our owned version should generalize this from quote validation into explicit `EvidenceSpan` objects with stable cue/source identity.

## 5. Upstream test posture

The inspected CI configuration runs on:

- Ubuntu latest;
- macOS latest;
- Windows latest;
- Python 3.11;
- Python 3.14.

The suite is run:

1. at the current clock;
2. with the clock shifted +365 days;
3. with the clock shifted +1826 days;
4. with lint checks.

The CI comments state the tests block real network access and stub YouTube/models/audio transcription.

The latest upstream commit at intake specifically fixes a Windows/Python 3.11 monotonic-clock edge case and adds regression coverage. This is strong evidence of a failure-first testing culture and is more valuable as a donor pattern than the implementation detail itself.

## 6. Relationship to existing BYSO / YouTube Intelligence work

The existing BYSO-derived lane already defines:

- `VideoSource`;
- `CaptionEvidence`;
- `CommentEvidence`;
- `VideoIntelligenceJob`;
- `PublishReadinessPackage`;
- deterministic source normalization;
- transcript normalization/export;
- bounded comment acquisition;
- grounded summary/Q&A as later processors;
- publish-preparation outputs.

worthwatch must **extend**, not duplicate, that architecture.

### Existing lane owns

```text
YouTube URL / media
  -> source normalization
  -> caption/comment evidence
  -> VideoIntelligenceJob
  -> transcript/comments/SEO/chapters/thumbnail processors
  -> PublishReadinessPackage
```

### worthwatch contributes

```text
ChannelSubscription
  -> discovery receipt
  -> existing VideoSource / CaptionEvidence
  -> ProjectContextSnapshot
  -> SignalAssessment
  -> EvidenceSpan checks
  -> PolicyCheckReceipt
  -> SignalVerdict
  -> ActionCandidate / IdeaCandidate
  -> SignalDigest
```

The two paths meet at shared evidence and can later feed the same Creator Console and Agent Work OS work queue.

## 7. Product thesis

The owned capability should not be positioned as "AI summarizes the YouTube channels you follow."

The stronger product promise is:

> **Turn trusted content sources into evidence-backed project decisions.** The system watches the sources you choose, identifies what matters to active projects, verifies the supporting evidence, checks it against standing project decisions, and proposes the next action without granting itself execution authority.

This supports both creator workflows and broader self-working-agent workflows.

## 8. MATCH / IMPROVE / NEW / OMIT

### MATCH

- watched-channel discovery;
- transcript-first evidence;
- relevance to current project context;
- typed verdict classes;
- deterministic policy checks after model judgment;
- contiguous quote/evidence validation;
- daily/periodic digest;
- idea capture;
- provider-neutral model interface;
- MCP/agent access;
- bounded provider behavior and cooldown/refusal states;
- local/private-by-default design where appropriate.

### IMPROVE

- replace one free-form `context.md` with versioned project/workspace state;
- bind recommendations to stable source/evidence IDs;
- record `OBSERVED | DERIVED | INFERRED | UNKNOWN | VERIFIED` states explicitly;
- store policy outcomes as typed receipts rather than prose annotations;
- make acquisition budget/quota state explicit and replayable;
- separate source acquisition from assessment so models can be replayed against frozen evidence;
- deduplicate the same action/idea across multiple videos;
- distinguish `contradicts standing policy` from `presents competing advice`;
- support independent verifier/evaluator without mutation authority;
- add false-positive relevance evaluation;
- route accepted candidates into Agent Work OS proposals/work items;
- keep publication/send/deploy authority completely separate.

### NEW OWNED CONTRACTS

- `project-context-snapshot/v1`
- `source-subscription/v1`
- `source-discovery-receipt/v1`
- `signal-assessment/v1`
- `evidence-span/v1`
- `policy-check-receipt/v1`
- `action-candidate/v1`
- `idea-candidate/v1`
- `signal-digest/v1`
- `signal-run/v1`
- `provider-budget-receipt/v1`

Do not duplicate `VideoSource`, `CaptionEvidence`, `VideoIntelligenceJob`, or existing workspace/job/quota primitives.

### OMIT / DEFER

- donor branding/trade dress/copy;
- transplanting the monolithic `core.py` architecture;
- copying prompts as owned product IP;
- unrestricted audio download/transcription;
- bypassing YouTube refusals/rate limits;
- autonomous publication from a digest;
- generic action execution just because a source was judged useful;
- a second YouTube ingestion store;
- a standalone worthwatch clone;
- built-in scheduler parity until the owned periodic-run contract is independently specified.

## 9. Phase A contracts

### `ProjectContextSnapshot`

Minimum fields:

- `workspaceId`;
- `projectId`;
- `projectRevision`;
- `goals[]`;
- `activeWorkstreams[]`;
- `standingDecisions[]`;
- `constraints[]`;
- optional domain/entity vocabulary;
- `createdAt` / source provenance;
- canonical deterministic digest.

The snapshot is immutable. A later project change produces a new snapshot/digest.

### `EvidenceSpan`

Minimum fields:

- source evidence ID;
- transcript/caption normalization version;
- start/end cue or offset identity;
- canonical text;
- support result: `supported | unsupported | ambiguous`;
- comparison/normalization rule version;
- deterministic digest.

A quote assembled from non-contiguous transcript regions must not become `supported`.

### `SignalAssessment`

Minimum fields:

- assessment ID;
- exact source/video evidence identity;
- exact `ProjectContextSnapshot` digest;
- requested assessment policy/version;
- provider/model identity when model-assisted;
- verdict: `YES | OPPORTUNITY | MAYBE | NO`;
- candidate recommendations;
- evidence-span references;
- warnings/unknowns;
- deterministic digest.

### `PolicyCheckReceipt`

Minimum fields:

- policy/decision-set digest;
- candidate identity;
- result: `allow | demote | reject | review`;
- machine-readable reason code;
- before/after verdict if changed;
- exact policy rule/version;
- deterministic receipt digest.

### `ActionCandidate`

Minimum fields:

- stable candidate ID;
- target project/workstream;
- proposed action;
- evidence references;
- originating assessments/sources;
- confidence/status;
- dedupe key;
- promotion state;
- explicit marker that this is a **proposal, not authority**.

### `IdeaCandidate`

Same provenance/dedupe principles as `ActionCandidate`, but represents exploratory product/content/research ideas rather than an immediate work action.

## 10. Required negative tests

Phase A must prove at least:

1. same canonical inputs -> same digests;
2. project-context revision -> changed assessment identity/digest;
3. standing-decision/policy revision -> stale prior policy equivalence cannot be reused;
4. quote from one contiguous source passage can be supported;
5. quote stitched from two separated passages fails;
6. very short/generic phrase cannot become strong evidence by itself;
7. recommendation with no valid evidence cannot be promoted;
8. model-positive verdict that violates standing policy is deterministically demoted/rejected;
9. duplicate action/idea candidate from replay deduplicates deterministically;
10. verifier cannot mutate the assessment it checks;
11. secrets/tokens are rejected/redacted from receipts;
12. no signal verdict grants send/post/deploy/merge/payment authority.

## 11. Phase B — watched-source discovery

After the deterministic core passes:

- versioned `SourceSubscription`;
- bounded channel scan;
- durable cursor/checkpoint;
- idempotent discovery;
- explicit scan budget;
- provider request receipt;
- typed `RATE_LIMITED`, `BLOCKED`, `WAIT`, `UNAVAILABLE` states;
- no silent fallback to alternate scraping when policy/provider state says wait;
- safe restart/resume without duplicate source records.

## 12. Phase C — grounded relevance / recommendations

- provider-neutral model invocation through existing platform adapters;
- frozen `ProjectContextSnapshot` + transcript evidence as inputs;
- schema-constrained `SignalAssessment` output;
- post-model `EvidenceSpan` verification;
- post-model `PolicyCheckReceipt`;
- unsupported claim/action -> reject/demote/review;
- model timeout/failure cannot mark a source reviewed;
- exact provider/model/version becomes part of the assessment receipt.

## 13. Phase D — digest / idea lifecycle

- assemble periodic digest from persisted receipts, not chat memory;
- dedupe/cluster related actions across sources;
- show evidence and policy outcome beside each recommendation;
- promote accepted candidate to Agent Work OS WorkItem proposal;
- never promote to execution grant automatically;
- preserve rejected/demoted items for audit/evaluation where useful.

## 14. Phase E — multi-source generalization

Once YouTube is proven, preserve the project-signal contracts and add source adapters for:

- Reddit;
- RSS/newsletters;
- articles/web pages;
- internal docs/files;
- public GitHub releases/docs.

The core signal/evidence/policy model should not depend on YouTube-specific URL or caption logic.

## 15. Evaluation plan

Do not evaluate only whether the model writes a nice digest.

Track:

### Relevance quality

- precision of `YES`/`OPPORTUNITY` decisions;
- false-positive rate;
- false-negative sample review;
- action usefulness after human review.

### Evidence quality

- unsupported quote/claim rate;
- evidence-span coverage per promoted action;
- ambiguous evidence rate;
- verifier disagreement rate.

### Policy quality

- policy-conflict catch rate;
- false demotion/rejection rate;
- stale-policy replay blocks;
- unknown/review honesty.

### Runtime reliability

- duplicate discovery rate (target zero);
- resume/recovery correctness;
- provider-budget adherence;
- rate-limit/refusal honesty;
- replay determinism.

### Product usefulness

- digest -> accepted candidate rate;
- accepted candidate -> completed WorkItem rate;
- repeated/duplicate idea suppression;
- time saved vs manually reviewing the watched sources.

## 16. Clean-room / license boundary

Upstream is Apache-2.0. Direct reuse is legally possible subject to Apache-2.0 obligations, including notices/attribution where required.

For this roadmap, default to **independently authored implementation** because:

- our data model/workspace/runtime differs;
- the owned lane already has ingestion/evidence/job primitives;
- a clean contract boundary reduces architectural coupling;
- behavior/test ideas are more valuable than copying a monolithic module.

If any upstream routine is intentionally reused later:

1. record exact upstream repository/SHA/path;
2. record the precise reused portion;
3. preserve required Apache-2.0 notices;
4. add a provenance entry to this dossier or the implementation PR;
5. keep our own tests and acceptance contract independent.

## 17. REA evidence ledger

| Evidence | Classification | Use |
| --- | --- | --- |
| Reddit launch post | OBSERVED / CREATOR CLAIM | user problem, launch capability claims, scheduler-not-yet boundary |
| README at pinned SHA | OBSERVED | product flow, privacy, backends, install/use behavior |
| `pyproject.toml` | OBSERVED | package version, Python version, dependencies, license metadata |
| `mcpserver.py` | OBSERVED SOURCE | tool boundary, input/path/command/provider constraints |
| `summaryrules.py` | OBSERVED SOURCE | contiguous evidence check and deterministic post-model rule pattern |
| `brains.py` | OBSERVED SOURCE | provider-neutral backend pattern |
| `docs/agents.md` | OBSERVED SOURCE | MCP/agent integration claims and tested-vs-untested statements |
| `.github/workflows/ci.yml` | OBSERVED SOURCE | CI matrix, network-stubbed test posture, clock-shift regression runs |
| latest upstream commit | OBSERVED SOURCE | Windows/Python monotonic-clock failure/recovery evidence |
| original Reddit feedback that found old quote bug | UNRESOLVED EXTERNAL EVIDENCE | creator says it exists; not independently located in this pass |

## 18. Current truthful status

```text
SOURCE=done
IDENTITY=done
UPSTREAM_SHA=99c66d223cbe0783251f8cdf6874b207dea74048
LICENSE=Apache-2.0
PUBLIC_CODE_SCAN=first-pass-done
THREAD_FEEDBACK=no-substantive-current-corpus
INTERNAL_DEDUPE=done
ROUTING=donor-to-existing-youtube-intelligence
OWNED_PRODUCT_THESIS=done
MATCH_IMPROVE_NEW_OMIT=done
PHASE_A_CONTRACTS=specified
PHASE_A_NEGATIVE_TESTS=specified
IMPLEMENTATION=not-started-by-this-dossier
LIVE_PROVIDER_TESTS=none
MODEL_EVAL=none
UAT=none
DEPLOYMENT=none
SHIPPED=no
```

## 19. Next implementation action

Implement the smallest deterministic Phase A slice behind issue #34:

1. canonical JSON/digest helper using existing repository conventions;
2. `ProjectContextSnapshot`;
3. `EvidenceSpan` contiguous-support checker over normalized caption cues;
4. `SignalAssessment`;
5. `PolicyCheckReceipt`;
6. `ActionCandidate` / `IdeaCandidate` dedupe identity;
7. the required negative/replay tests.

Do **not** add live YouTube acquisition, model calls, scheduling, publication or Agent Work OS mutation until the deterministic contracts/tests pass and exact-head evidence exists.