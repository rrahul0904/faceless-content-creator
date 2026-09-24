# RE-227 — MissingLink model-runtime reverse engineering

Status: research/architecture started  
Canonical destination: `rrahul0904/faceless-content-creator`  
Relationship: capability donor, not a standalone clone  
Discovery source: https://www.reddit.com/r/vibecoding/comments/1wolia6/2_hours_of_videoaudio_with_minimax_h3_video_for/  
Product surface: https://missinglink.build/  
Public reference repository: https://github.com/PotentiallyARobot/MissingLink

## 1. Decision

MissingLink is useful to this repository primarily as a **GPU-aware generative-model runtime and optimization layer**. Faceless Content Creator already owns the higher-level product loop—workspace isolation, programmable templates, durable renders, media, quotas/credits, a GPU-service boundary, and social publishing—so creating a second product would duplicate existing capabilities.

The clean-room target is therefore:

```text
creative request
  -> canonical generation contract
  -> model + runtime profile selection
  -> entitlement / quota / credit reservation
  -> durable GPU job
  -> preflight + artifact verification
  -> model execution
  -> telemetry + reproducibility receipt
  -> output registration
  -> credit settlement/refund
  -> existing Studio / render / publish workflows
```

## 2. Evidence and claims boundary

Public product material exposes four connected surfaces:

- creator Studio for image generation/editing, camera/reshoot flows, batches, sequences, agents, history and related media workflows;
- maintained GPU-aware notebook/runtime workflows for model families such as image, video and 3D generation;
- token-authenticated HTTP API with shared account/usage concepts;
- a long-lived agent/control surface that manages runs, pause/power/cycle state, memory, import/export and task execution.

Public pages also describe hardware-aware runtime choices across GPU classes, pinned CUDA/PyTorch/attention/quant/memory combinations, entitlement-gated runtime components, queue/timeline controls, and live GPU telemetry.

The Reddit author reports large cost reductions and roughly one minute to create a 15-second 768×768 MiniMax H3 clip on a Blackwell configuration. Those are **creator benchmark claims**, not our verified performance evidence. They must never be used as our launch or parity claim until reproduced on controlled hardware.

The public upstream repository exposes no detected license. That makes the boundary strict: public code, notebooks, site assets and copy are reference-only. We may derive product requirements from observable behavior, but our implementation must be independent.

## 3. Product loop decomposition

### 3.1 Identity, entitlement and billing

Observed behavior suggests a single account/entitlement boundary spanning Studio, runtime artifacts and API usage, with trial/subscription management and usage balances.

Our implementation should reuse the existing workspace and plan model instead of introducing a second identity domain.

Required contracts:

- workspace membership and role remain authoritative;
- a plan/entitlement decides whether a model/runtime profile can execute;
- usage reservation happens before expensive execution;
- settlement is idempotent;
- failed/cancelled work refunds only the unsettled reservation;
- billing-provider state is external evidence and must not be inferred from local flags.

### 3.2 Model catalog

A model is not just a checkpoint. The catalog must describe the complete execution envelope:

```text
ModelDefinition
- id / slug / version
- modality: image | video | 3d | audio | multimodal
- source + license + provenance
- artifact manifests
- supported RuntimeProfile ids
- request schema version
- output schema version
- quality/safety capabilities
- entitlement class
- lifecycle status
```

No model enters the catalog without a reviewable source and license.

### 3.3 Runtime profile registry

A runtime profile is an immutable compatibility record, not an ad-hoc notebook setup:

```text
RuntimeProfile
- id / version
- gpu architecture family
- minimum VRAM
- driver constraints
- CUDA version
- Python version
- Torch version
- attention backend/version
- quantization strategy
- memory strategy
- artifact manifest hash
- container/image digest where applicable
- supported model versions
- preflight checks
- benchmark status
- promoted / deprecated state
```

Profile selection must fail closed when hardware or software facts are unknown or incompatible.

### 3.4 Artifact acquisition

Premium or large runtime artifacts should be handled as signed/hashed artifacts, never credentials embedded in notebooks or package URLs.

Rules:

- auth token travels in a request header over TLS;
- URLs/logs never contain bearer credentials;
- manifest records source, hash, size and expected compatibility;
- downloads land in a temporary or content-addressed location;
- hash and size are verified before install/load;
- partial files are rejected;
- telemetry redacts credentials and signed URLs;
- secret scanning is a repository gate.

The public MissingLink support notes acknowledge a historical credential-rotation concern. Our implementation should make that class of error structurally difficult rather than relying on convention.

## 4. Durable generation domain

### 4.1 GenerationJob

```text
GenerationJob
- id
- workspaceId
- modelDefinitionId
- runtimeProfileId
- adapter
- requestSchemaVersion
- normalized request
- status: QUEUED | CLAIMED | RUNNING | CANCEL_REQUESTED | SUCCEEDED | FAILED | CANCELLED
- idempotencyKey
- reservedCredits
- settledCredits
- attempt
- leaseOwner / leaseExpiresAt
- timestamps
- failureClass / safe failure detail
```

### 4.2 GenerationOutput

```text
GenerationOutput
- id
- generationJobId
- workspaceId
- media asset reference
- media type
- width / height / duration / frame rate where relevant
- content hash
- createdAt
```

Outputs inherit workspace ownership and the repository's existing media authorization boundary.

### 4.3 RuntimeReceipt

Every successful or failed attempt should leave a reproducibility receipt:

```text
RuntimeReceipt
- generationJobId / attempt
- model version
- runtime profile version
- artifact manifest hash
- worker build SHA / image digest
- GPU model + VRAM
- driver/CUDA/Torch facts
- seed where supported
- normalized execution parameters
- cold/warm classification
- queue wait
- setup/load duration
- generation duration
- peak VRAM
- utilization summary
- outcome + failure class
```

This is the evidence layer needed to distinguish marketing benchmarks from reproducible performance.

## 5. Worker and lease architecture

Use the same durable state discipline already present in render jobs.

```text
API
  -> transaction: validate tenant + entitlement + reserve usage + create QUEUED job
  -> worker atomically claims job with lease
  -> runtime preflight
  -> artifact validation
  -> adapter load
  -> RUNNING
  -> generation
  -> output validation/persist
  -> settle credits
  -> SUCCEEDED
```

Cancellation:

- QUEUED: cancel immediately and release reservation.
- CLAIMED/RUNNING: mark `CANCEL_REQUESTED`; worker stops at a safe boundary; late output is discarded unless the contract explicitly supports partial output.
- Terminal transitions are idempotent.
- An expired lease can be reclaimed only under explicit retry rules.
- Settlement/refund is driven by durable state, not client disconnects.

## 6. Provider-neutral adapters

The core domain must not depend on Colab, one GPU provider, one model host or one inference API.

```ts
interface GenerationAdapter {
  id: string;
  preflight(ctx: RuntimeContext): Promise<PreflightResult>;
  execute(job: NormalizedGenerationRequest, ctx: RuntimeContext): Promise<GenerationResult>;
  cancel?(executionId: string, ctx: RuntimeContext): Promise<void>;
  health(ctx: RuntimeContext): Promise<AdapterHealth>;
}
```

Initial adapter is deterministic/mock or a locally available test adapter. Real GPU adapters are later certification work.

Potential adapter classes after Phase A:

- repository-owned local/container GPU worker;
- hosted GPU worker pool;
- external provider adapter for overflow/fallback;
- optional notebook/Colab launcher only if it can preserve the same contract and evidence.

## 7. Deterministic runtime selection

Selection inputs:

- requested model/version;
- worker GPU architecture and VRAM;
- driver/runtime facts;
- request requirements: resolution, frames/duration, batch, precision;
- tenant entitlement;
- profiles in `PROMOTED` state.

Selection algorithm:

1. reject profiles not supporting the exact model version;
2. reject profiles that fail GPU/VRAM/runtime constraints;
3. reject profiles outside entitlement;
4. reject profiles without certified artifact manifests;
5. rank remaining profiles by an explicit versioned policy;
6. persist the selected profile and selection-policy version on the job;
7. never silently fall back to an uncertified configuration.

A deterministic ranking policy can prefer stability tier first, then cost/throughput. Quality-sensitive requests can declare a minimum quality tier.

## 8. Optimization experiment runner

The most transferable MissingLink idea is not a specific CUDA trick; it is the continuous search over compatible runtime configurations.

Represent this as an **offline experiment service**, separate from customer jobs.

```text
OptimizationExperiment
  -> model version + evaluation corpus
  -> candidate matrix:
       runtime profile
       precision / quant
       attention backend
       memory strategy
       batch/resolution/steps
  -> fail-fast preflight
  -> warmup
  -> repeated benchmark runs
  -> quality/stability evaluation
  -> candidate receipts
  -> human/review policy
  -> PROMOTED profile version
```

A candidate is never promoted on speed alone. Promotion gates should include:

- deterministic environment capture;
- no missing/corrupt artifacts;
- no OOM or fatal runtime errors in the certification set;
- bounded failure rate across repeated runs;
- quality gates appropriate to the model;
- measured latency/throughput/VRAM;
- rollback target retained;
- exact evidence stored.

The optimizer may propose or execute experiments autonomously, but profile promotion must remain governed and auditable.

## 9. Telemetry

Worker telemetry is operational evidence, not analytics decoration.

Capture at bounded cadence:

- GPU utilization;
- VRAM used/total;
- temperature/power when available and allowed;
- stage name;
- queue wait;
- artifact download/setup/load time;
- generation latency;
- retry/failure class.

Do not store prompts or generated media in infrastructure telemetry unless the product contract explicitly requires it. Workspace content stays under the media/data boundary.

## 10. API blueprint

Phase A API:

```text
GET  /api/v1/models
GET  /api/v1/runtime-profiles
POST /api/v1/generation-jobs
GET  /api/v1/generation-jobs
GET  /api/v1/generation-jobs/:id
POST /api/v1/generation-jobs/:id/cancel
GET  /api/v1/generation-jobs/:id/telemetry
GET  /api/v1/generation-jobs/:id/receipt
```

Later operator endpoints:

```text
POST /api/v1/runtime/benchmarks
GET  /api/v1/runtime/benchmarks
POST /api/v1/runtime/experiments
GET  /api/v1/runtime/experiments/:id
POST /api/v1/runtime-profiles/:id/promote
POST /api/v1/runtime-profiles/:id/deprecate
```

Operator mutation endpoints need explicit authorization and audit records.

## 11. Integration with Faceless Content Creator

Reuse, do not duplicate:

- workspace tenant boundary;
- API-key fail-closed hosted mode;
- plan and membership controls;
- existing usage/credit-ledger foundation;
- media storage authorization;
- durable render job semantics;
- AI-video service boundary;
- browser Studio patterns.

New runtime services should sit below the creative engine:

```text
Template / content / semantic timeline
       |
       +--> deterministic FFmpeg render
       |
       +--> Generation service
              -> image
              -> video
              -> 3D
              -> future audio
       |
Review / compose / publish
```

This allows generated assets to become normal workspace media and then flow through existing template/render/publish functionality.

## 12. Monetization model

Do not clone MissingLink's exact pricing. Reuse our plan/credit architecture.

Meter units can include:

- successful generation result;
- GPU-second equivalent;
- model-specific credit weight;
- output size/duration;
- premium runtime entitlement.

The durable ledger should expose reserve, settle, refund and adjustment entries. Pricing tables are product policy; execution accounting remains provider-neutral.

## 13. Security and governance

Required controls before a real GPU model is enabled:

- allowlisted model/artifact sources;
- source license/provenance recorded;
- content-addressed artifact verification;
- no arbitrary user-supplied shell/package commands;
- pinned runtime/container dependencies;
- egress policy for workers;
- secrets injected at execution, never committed;
- log redaction;
- workspace isolation for jobs, outputs and receipts;
- bounded retries and spend caps;
- idempotent billing/usage mutations;
- cancellation and lease expiry tests;
- operator-only runtime promotion;
- audit trail for profile changes.

## 14. Verification matrix

### Repository-only certification

- schema/migration applies cleanly;
- runtime-selection unit tests;
- no-compatible-profile fails closed;
- entitlement/plan rejection;
- workspace isolation;
- idempotent job create;
- atomic claim/lease;
- cancellation state machine;
- reserve/settle/refund invariants;
- receipt schema reproducibility;
- mock adapter success/failure/timeouts;
- secret scan;
- production build and existing media acceptance paths remain green.

### Live GPU certification

Keep this evidence separate from repository CI:

- exact machine/GPU/driver/runtime facts;
- model and artifact hashes;
- clean-start install/load;
- cold and warm generation;
- repeated runs;
- peak VRAM;
- timing;
- output validation;
- cancellation;
- worker restart/recovery;
- one intentionally incompatible profile proving fail-closed selection.

No performance claim is promoted to product copy until this evidence exists.

## 15. Implementation phases

### Phase A — owned runtime contract

Implement persisted runtime/model/job/output/receipt contracts, deterministic selection, provider-neutral adapter, mock/local worker, telemetry persistence and credit-ledger integration. No real MissingLink model/runtime parity claim.

### Phase B — one independently sourced open model

Choose a model with explicit compatible licensing, implement one GPU adapter on hardware we control, capture exact live evidence and expose generated media to the existing creative engine.

### Phase C — optimization experiments

Add candidate matrices, benchmark/evaluation corpus, repeated receipts, governed promotion/deprecation and rollback.

### Phase D — product surface

Integrate model selection and generation history into Studio/API, then compose generation outputs through templates and publishing.

### Phase E — optional portable notebook/runtime surface

Only if user value justifies it: expose an independently implemented portable notebook/Colab path using the same model/runtime/receipt contracts. Do not make notebook-specific behavior the core architecture.

## 16. Phase A acceptance criteria

Phase A is done only when:

1. `RuntimeProfile` selection is deterministic and unit-tested.
2. No compatible profile fails closed before usage is settled.
3. One on-demand generation job survives process boundaries through durable state.
4. The mock/local adapter cannot bypass workspace/plan/usage gates.
5. Cancellation produces a terminal state and correct refund behavior.
6. A `RuntimeReceipt` records enough immutable facts to reproduce the selected configuration.
7. Tenant isolation tests cover job, output, telemetry and receipt reads.
8. Exact-head CI passes.
9. README/docs state explicitly that real GPU model performance remains uncertified.

## 17. Explicitly unclaimed

This research does **not** establish that our repository currently has:

- MiniMax H3;
- a Blackwell-tuned CUDA runtime;
- MissingLink's proprietary/prebuilt wheel set;
- Colab parity;
- a real optimization agent;
- hosted image/video/3D inference;
- creator-reported price/performance parity;
- production-ready GPU scheduling;
- commercial launch readiness.

Those claims become valid only after independent implementation and evidence.
