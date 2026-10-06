# Workflow Reconstruction v0.1

This is the first evidence-derived workflow model. It is not a UI sitemap.

## Primary job

**Turn technical change, expertise, or a broad domain into credible educational content that demonstrates real understanding without manufacturing experience.**

## Entry modes

1. **Current development** — a new release, architecture change, benchmark, paper, repo or engineering post.
2. **Author expertise** — a real lesson, project, decision, failure, migration, architecture choice or opinion owned by the creator.
3. **Broad domain** — e.g. RAG, Snowflake, agentic AI, data engineering; suitable for a question map or ordered series.
4. **External source** — article, PDF, video, LinkedIn/Reddit post, repository or documentation supplied by the creator.

## Reconstructed state machine

### 1. CAPTURED

Input exists, but no product claim is made yet.

Required data:
- source/idea
- source class
- author of source when known
- capture reason / creator reaction when available

Transitions:
- → `UNDERSTANDING` if source is accessible
- → `UNRESOLVED` if source cannot be resolved

### 2. UNDERSTANDING

System reconstructs what the source actually says/does before using it.

Tasks:
- identify underlying product/project/docs
- extract observable workflow, claims and artifacts
- follow first-party links
- distinguish tutorial/reference from production behavior

Failure modes:
- inaccessible source
- metadata-only source
- conflicting versions
- unclear provenance

### 3. EVIDENCE_READY

Claims are mapped to primary or appropriately labeled secondary sources.

Must contain:
- claim
- evidence excerpt/observation
- source URL
- source class
- confidence
- freshness/date when relevant

Blocked when:
- technical claim has only style/reference evidence
- benchmark lacks conditions/source
- source says “reference/tutorial” but draft implies production readiness

### 4. AUTHORSHIP_READY

The system has enough of the creator's actual point of view.

Possible collection methods:
- typed reaction
- targeted follow-up questions
- short voice interview
- existing author-owned project notes/history

The system should ask for missing **judgment**, not generic “tell me more.”

Examples:
- “Do you agree with this architecture choice? Why?”
- “Where would this fail in a real data platform?”
- “What would you do differently?”
- “Have you seen a related trade-off in your own work?”

Blocked when the draft would otherwise invent first-person experience or a strong opinion.

### 5. CONTENT_PLAN

Choose the artifact based on the job, not a fixed post template.

Possible outputs:
- single technical lesson
- comparison
- architecture teardown
- benchmark explanation
- implementation walkthrough
- question map
- ordered learning series
- project-backed build-along series
- carousel/diagram
- LinkedIn short form + Medium long form pair

For broad domains, the system evaluates whether a **series** is more appropriate than a single post.

### 6. ARTIFACT_READY

Where appropriate, produce or attach proof-bearing material:
- architecture/data-flow diagram
- code example
- SQL/Python snippet
- benchmark table
- test or evaluation result
- source matrix
- implementation checklist

A text-only post is acceptable only when the subject does not require an artifact.

### 7. DRAFTED

Write platform-native content from:

`evidence + author-owned judgment + content plan + artifact`

Not from reference style alone.

### 8. REVIEWED

Independent critic checks:
- unsupported claims
- fake first-person experience
- source mismatch
- reference copying / phrase similarity
- shallow explanation
- missing trade-off
- missing production caveat
- mismatch between headline and evidence
- excessive generic AI phrasing

### 9. APPROVAL_REQUIRED

Creator sees:
- final content
- evidence used
- author claims used
- artifact(s)
- differences between LinkedIn/Medium variants

No publishing side effect before explicit approval.

### 10. PUBLISHED / EXPORTED

Publication receipt records exact approved content hash and destination.

### 11. LEARNED

Performance data is linked back to meaningful content dimensions:
- topic
- audience
- content type
- depth
- artifact type
- hook category
- evidence density
- series position

The learning loop should recommend strategy changes, not simply “write more like the highest-impression post.”

## Series / learning-path branch derived from SRC-006 + SRC-007

For broad topics:

`DOMAIN → competency/question graph → prerequisite order → evidence packet per node → one project spine (optional) → individual lessons → cumulative artifact`

Example candidate for testing:

`Data Engineering + GenAI → SQL → Python data workloads → DE systems → Spark/Airflow/dbt/Kafka → GenAI primitives → RAG → MCP → end-to-end cited assistant project`

This is **not yet an accepted feature**; it is a behavior hypothesis now precise enough to test.
