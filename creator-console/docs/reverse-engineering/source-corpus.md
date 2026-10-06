# Source Corpus

This file records source material before any product decision is made.

| ID | Source | Class | Resolution | What it can tell us | What it cannot prove |
|---|---|---|---|---|---|
| SRC-001 | Nick Akincilar LinkedIn corpus in `data/references.json` | first-party-public | resolved/partial | recurring technical-content structures: product update, comparison, architecture, implementation artifact, diagram-led explanation | that every technical claim is correct without primary-source verification |
| SRC-002 | Dash DesAI — Snowflake AI/Cortex posts | first-party-public | resolved | announcement → mechanics → production implication → official source pattern; benchmark-led technical education | benchmark validity beyond independently checked source data |
| SRC-003 | Patrick Wendell — Databricks frontier-model rollout | first-party-public | resolved | internal engineering story: rollout, evaluation, budgets, promote/drop decision | generalized effectiveness outside Databricks |
| SRC-004 | Ajeya Krishna — LLM gateway latency | first-party-public | resolved | quantitative hook, myth-busting, architecture/performance framing | benchmark conditions unless independently validated |
| SRC-005 | Tanmay Garg — Databricks growth narrative | first-party-public | resolved | timeline/business storytelling structure | valuation/revenue figures without independent verification |
| SRC-006 | Yash V. — FDE / Applied Agentic AI interview map | first-party-public | resolved | question-led deep technical taxonomy across inference, RAG, agents, MCP, evaluation, governance and production judgment | that named companies asked the exact listed questions |
| SRC-007 | Gaurav Sinha — Data Engineering and GenAI Project-Based Learning Path | first-party-public | resolved | sequenced curriculum artifact; competency ordering; one end-to-end project as learning spine; resource curation | resource quality/effectiveness by itself; audience outcomes without feedback evidence |
| SRC-008 | r/snowflake share `m5CChBnsxT` | community-feedback | unresolved | pending community pain point / practitioner signal | no title, claims or sentiment may be inferred until resolved |
| SRC-009 | r/snowflake share `UJtFzSpGMD` | community-feedback | unresolved | pending community pain point / practitioner signal | no title, claims or sentiment may be inferred until resolved |
| SRC-010 | User-provided dbt Charts launch visual (`IMG_8433.png`) | observed-ui | resolved image + official-doc corroboration | one-screen technical visual structure: strong claim → before-state architecture → code/config change → rendered outcome → concise benefits; visual hierarchy for explaining product changes | that the screenshot alone proves product behavior, public-beta status, performance, governance or usability |

## SRC-007 resolved content

Original: `https://lnkd.in/p/gEkz8Etb`

Resolved LinkedIn post title: **Data Engineering and GenAI Project-Based Learning Path** — Gaurav Sinha.

Observable structure:

1. Rejects course-hoarding as the default learning strategy.
2. Orders learning into a sequence rather than a flat resource dump.
3. Covers SQL → Python/data workloads → data-engineering fundamentals → core tools → GenAI → RAG → MCP.
4. Attaches concrete resources to each stage.
5. Ends with a single portfolio-project blueprint that combines ingestion, cleaning, chunking, metadata, search/indexing, RAG with citations, MCP exposure, incremental ingestion, duplicate handling, access control, evaluation, monitoring and recovery.
6. Uses the project as the proof-of-skill artifact instead of certificates.

Independent source checks performed:

- SQLBolt is an interactive SQL lesson/exercise site (`https://sqlbolt.com/`).
- Data Engineering Zoomcamp is an official DataTalks.Club project-based course with modules, homework and a final project (`https://github.com/DataTalksClub/data-engineering-zoomcamp`).
- OpenAI Cookbook is OpenAI's official examples/guides repository (`https://github.com/openai/openai-cookbook`).
- MCP reference servers are maintained as educational/reference implementations and explicitly warn that they are not production-ready by default (`https://github.com/modelcontextprotocol/servers`).

## SRC-010 observed visual structure

User-provided image: `IMG_8433.png`.

Directly observable elements:

1. A single provocative technical headline: “Your next BI dashboard might just be a YAML file.”
2. Explicit product-state label: “dbt Charts is now in public beta.”
3. A **Before** panel showing a multi-tool chain: dbt transforms → warehouse → BI tool, with separate configs/manual setup/permissions called out as friction.
4. A **Now with dbt Charts** panel showing a YAML file and the rendered dashboard together in the same visual frame.
5. Three compressed benefit statements at the bottom: define dashboards in YAML, version control/review/test/deploy with the dbt project, and data-team-oriented integration.
6. The composition teaches through contrast and an executable-looking artifact rather than a decorative illustration.

Independent first-party corroboration:

- dbt Developer Hub states that dbt Charts turns YAML files into interactive dashboards and stores queries/charts/layout alongside the dbt project.
- dbt release notes identify dbt Charts as public beta.
- dbt's product page describes the language as declarative YAML, version-controlled beside dbt models, with local/CI/platform workflows.

Clean-room rule:

The visual grammar may inform Creator Console's artifact planning, but the final product must not copy dbt's artwork, exact wording, brand styling, icons, or composition. We should reconstruct the explanatory behavior with an original visual system.

## Open source-research gaps

- LinkedIn comment/reaction evidence for SRC-001 through SRC-007 is not yet comprehensively captured.
- The two Reddit shortlinks remain unresolved.
- Competitor product workflows still need direct reconstruction rather than feature-list comparison.
- SRC-010 gives strong visual-communication evidence but no audience-response data yet; do not treat it as proof that this layout improves engagement without further evidence.
