# Internal Donor Audit

The current application is donor code. This audit maps modules to the reconstructed workflow rather than assuming current screens are correct.

| Donor module | Current role | Evidence-derived need | Decision | Required change |
|---|---|---|---|---|
| `lib/research-agent.js` | crawls official OpenAI/Anthropic/Snowflake/Databricks surfaces, enriches metadata, ranks | CAPTURED → UNDERSTANDING → EVIDENCE_READY | KEEP/REWRITE | move from generic metadata enrichment to claim/source extraction; support user-supplied sources and evidence classes; ranking should include strategy/series relevance, not only recency |
| `lib/context.js` | retrieves expertise/history/reference patterns | AUTHORSHIP_READY support | REWRITE | separate author-owned claims, opinions, stories, prior content, public evidence and structural references; add provenance and “allowed first-person claim” contracts |
| `lib/harness.js` | evidence gate → writer → critic → revision → approval receipt | DRAFTED → REVIEWED → APPROVAL_REQUIRED | KEEP CORE / EXTEND | insert AUTHORSHIP_READY, CONTENT_PLAN and ARTIFACT_READY gates; critic must check shallow explanation and artifact/source mismatch |
| `lib/prompt.js` | fixed platform prompts | content-plan execution | REPLACE | prompts must be derived from content type (comparison, architecture teardown, question map, series lesson, project build-along) rather than one universal post shape |
| `lib/approval.js` | signs exact content and validates unchanged drafts | explicit approval guardrail | KEEP | retain content-bound approval; extend receipt to include evidence/author-claim/artifact hashes |
| `lib/store.js` + `db/schema.sql` | profiles, research items, drafts, publications | durable state across workflow | KEEP FOUNDATION / EXPAND | add sources, claims, author assertions, content plans, artifacts, series, lessons, performance observations and strategy decisions |
| `api/action.js` | consolidated storage/publish/export/resolve endpoints | workflow actions | PARTIAL KEEP | split domain contracts logically even if physically consolidated for Vercel limits; add source/evidence/series/artifact operations |
| `api/today.js` | serves ranked discovery | opportunity inbox | REWRITE | Today should show why an opportunity matters, evidence completeness, relation to editorial strategy, prior coverage and whether it belongs to a series |
| `api/context.js` | direct context-packet API | authorship/evidence assembly | REWRITE | replace generic retrieval endpoint with typed context/claim provenance output |
| `api/product-selftest.js` | certifies prototype invariants | acceptance certification | RETIRE/REPLACE | current checks prove internal mechanics, not reconstructed product behavior; new tests must come from `acceptance-tests.md` |
| `index.html`, `app.js`, `app.css` | Today/Research/Create/Library/Capabilities/Memory/Runs UI | final product UX unknown | DO NOT PRESERVE AS TARGET | reuse visual/components only if useful; information architecture must follow reconstructed job rather than current sidebar |
| `data/references.json` + `reference-inbox.json` | style/reference corpus | source corpus / structural evidence | MIGRATE | stop treating all creator material primarily as style; classify each source by what it teaches: workflow, proof, artifact, pedagogy, feedback, structure |
| `data/product-research.json` | six design principles | feedback evidence | MIGRATE/DEPRECATE | fold underlying observations into evidence/feedback matrices; remove unsupported “product decision” jumps |
| `tests/*.test.js` | unit tests for current modules | independent behavior verification | KEEP INFRASTRUCTURE | retain useful low-level tests but add source-derived end-to-end acceptance tests |

## What survives with highest confidence

1. **Fail-closed evidence behavior** — strongly aligned with technical credibility.
2. **Exact-content approval** — strong guardrail and compatible with official API publishing.
3. **Separate critic/revision stage** — directionally supported by community complaints about generic one-shot generation.
4. **Official-source discovery** — useful primitive, but not sufficient as “research.”
5. **Provenance receipts** — should expand beyond run receipts into source/claim/artifact receipts.

## What should not survive merely because it already exists

- the current sidebar
- the current “Today card → Your take → build LinkedIn + Medium” as the only path
- a fixed 2–3 minute output for every topic
- style-reference retrieval as the main meaning of reverse-engineering source ingestion
- “16/16 self-tests” as a product-completion metric

## New domain objects implied by reconstruction

- `SourceRecord`
- `ClaimEvidence`
- `AuthorAssertion`
- `UnderstandingReceipt`
- `ContentPlan`
- `ArtifactSpec`
- `ArtifactReceipt`
- `SeriesPlan`
- `SeriesLesson`
- `EditorialStrategy`
- `PerformanceObservation`
- `LearningDecision`

These are candidates for stage 9 behavior contracts, not implementation instructions yet.
