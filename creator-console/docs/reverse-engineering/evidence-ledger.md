# Evidence Ledger

Rules:

- `Observed` means directly present in the cited source.
- `Inference` means our interpretation and must not be presented as fact.
- `Decision status` is one of `KEEP`, `IMPROVE`, `NEW`, `OMIT`, `INVESTIGATE`.

| Evidence ID | Source | Class | Observed fact | Confidence | Product implication | Decision status |
|---|---|---|---|---|---|---|
| EV-001 | SRC-007 Gaurav Sinha | first-party-public | The post explicitly argues against collecting many disconnected courses and instead recommends a sequence plus one end-to-end project. | high | Creator Console should investigate a mode that produces coherent multi-piece learning/content arcs rather than isolated posts only. | INVESTIGATE |
| EV-002 | SRC-007 Gaurav Sinha | first-party-public | The curriculum is ordered SQL → Python → DE fundamentals → core tools → GenAI → RAG → MCP. | high | The system may need dependency-aware topic sequencing, not only recency ranking. | INVESTIGATE |
| EV-003 | SRC-007 Gaurav Sinha | first-party-public | Each learning stage is tied to concrete external resources. | high | A series planner should carry an evidence/resource packet per lesson. | INVESTIGATE |
| EV-004 | SRC-007 Gaurav Sinha | first-party-public | The closing project combines ingestion, cleaning/chunking, metadata, indexing/search, cited RAG, MCP, incremental ingestion, dedupe, access control, evaluation, monitoring and recovery. | high | Strong technical content can culminate in a build artifact; Creator Console should investigate “project-backed series” rather than content detached from implementation. | INVESTIGATE |
| EV-005 | DataTalksClub DE Zoomcamp | official-source / official-doc | The course is organized into modules and a final project; live cohorts add homework, peer review, leaderboard and certificate mechanics. | high | Sequencing + project + feedback is a proven educational workflow; if Creator Console adds learning-path content, completion artifacts and review should be first-class. | INVESTIGATE |
| EV-006 | OpenAI Cookbook | official-source | The repository provides examples and guides for common OpenAI API tasks, mostly executable Python examples. | high | Technical posts should be able to attach runnable examples / reference implementations, not just prose. | IMPROVE |
| EV-007 | MCP servers repo | official-source | The repository explicitly describes maintained servers as reference implementations and warns they are not production-ready by default. | high | Creator Console must distinguish “tutorial/reference implementation” from “production recommendation” in generated technical guidance. | KEEP/IMPROVE |
| EV-008 | SRC-006 Yash V. | first-party-public | The post organizes a large body of technical material as questions grouped around inference, RAG, agents, MCP, evaluation, governance and production judgment. | high | Broad topics can be decomposed into a question-led series or interview-prep artifact. | INVESTIGATE |
| EV-009 | SRC-003 Patrick Wendell | first-party-public + independently matched company engineering post | The storytelling pattern centers on rollout process, constraints, evaluation signals and operational decision criteria. | high | “How it works in production” and trade-off/evaluation sections should be supported content primitives. | IMPROVE |
| EV-010 | SRC-002 Dash DesAI | first-party-public + official release notes | Product-announcement content becomes more useful when converted into feature mechanics and production implications and linked back to primary documentation. | high | Current primary-source enrichment is directionally justified, but must be evaluated as part of a complete workflow. | KEEP/IMPROVE |
| EV-011 | Existing Creator Console prototype | observed-ui / internal-donor | Current UI centers Today → Research → Create → Library → Capabilities → Memory → Agent runs. | high | This navigation is donor behavior only; it is not accepted as the final information architecture until workflow reconstruction is complete. | INVESTIGATE |
| EV-012 | Existing prototype harness | internal-donor | The code has explicit evidence, context, writing, critic/revision, approval and publishing boundaries. | high | These are reusable engineering primitives if the reconstructed product still requires them. | INVESTIGATE |

## Inferences under test

These are hypotheses, not accepted product requirements:

1. **Series Planner** — turn a broad domain into an ordered 5–15 lesson sequence with prerequisite relationships.
2. **Project Spine** — connect a series to one build artifact that grows across lessons.
3. **Question Map** — convert a domain into architecture/interview/production questions, then map each question to evidence and content.
4. **Artifact-backed content** — prefer diagrams, code, benchmarks, tests or implementation receipts when the topic supports them.
5. **Evidence type awareness** — tutorial/reference code must be labeled differently from production guidance.

Each hypothesis remains `INVESTIGATE` until feedback and competitor evidence support it.
