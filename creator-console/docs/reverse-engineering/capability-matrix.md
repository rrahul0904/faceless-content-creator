# Capability Matrix — Initial

This is intentionally provisional. `Accepted` means there is enough evidence to keep the capability in the target product. `Investigate` means the current prototype may contain it, but the roadmap has not yet justified it.

| Capability | Source evidence | Current prototype | Decision | Required next proof |
|---|---|---|---|---|
| Timely topic discovery | Reddit creator pain points + technical-source corpus | official-source crawler and Today queue | IMPROVE | competitor workflow comparison + user feedback matrix |
| Primary-source verification | Dash/Patrick patterns + official docs | source enrichment + evidence gate | KEEP/IMPROVE | acceptance test for claim→source traceability |
| Claim-level authority scope | SRC-011 + Stanford CS336 comparison | absent before reset; added to reset reconstruction engine | KEEP/IMPROVE | runtime negative-path proof that creator hook cannot validate third-party compensation/company claims |
| Hook verification / source distillation | SRC-011 | absent as a first-class workflow | INVESTIGATE | test additional high-engagement posts where hook and linked source differ in authority |
| Creator point-of-view input | creator feedback corpus | “Your take” field | INVESTIGATE | verify that this is the right interaction versus interview/question prompts |
| Platform-native LinkedIn draft | creator corpus | implemented harness target | INVESTIGATE | reverse-engineer winning post structures and acceptance criteria |
| Medium adaptation | product goal | implemented separate target | INVESTIGATE | validate Medium workflow and whether long-form is a core job |
| Writer / critic separation | Reddit research and current harness | implemented | INVESTIGATE | compare against competing workflows and quality failures |
| Exact-content approval | agent-workflow safety requirement | implemented signed approval | KEEP as guardrail | runtime negative-path proof |
| Direct LinkedIn publish | desired product boundary | adapter implemented, account not connected | INVESTIGATE | official API + user value + recovery behavior |
| Durable creator memory | generic-output pain point | schema/adapter exists, not connected | INVESTIGATE | define what is author-owned versus learned and retention rules |
| Analytics learning loop | desired future state | not implemented | INVESTIGATE | publication/metric feasibility and actionable feedback model |
| Learning-path / series planner | SRC-006, SRC-007, SRC-011 official Stanford source | absent | INVESTIGATE | competitor + audience evidence; behavior contract |
| Dependency-aware sequencing | SRC-007 + Stanford CS336 course structure | absent | INVESTIGATE | prove value beyond a manually ordered outline |
| Project spine / build-along artifact | SRC-007 + DataTalksClub project model + Stanford implementation-heavy assignments | absent | INVESTIGATE | define suitable content categories and artifact receipts |
| Question-map decomposition | SRC-006 | absent | INVESTIGATE | test against broad topics such as RAG, Snowflake, agentic AI |
| Code / diagram / benchmark artifacts | Nick/Dash/Patrick + official technical sources | only visual brief scaffold | IMPROVE | reconstruct artifact generation and verification workflow |
| Proof-bearing visual explainer | SRC-010 dbt Charts observed UI + official dbt docs | absent as a structured artifact type | INVESTIGATE | validate against additional technical visuals; prove claim→visual-label provenance and clean-room rendering |
| Before/after architecture contrast | SRC-010 | absent | INVESTIGATE | identify topics where contrast genuinely explains a state change versus forcing a template |
| Config/code-to-rendered-outcome visual | SRC-010 + official dbt Charts docs | absent | INVESTIGATE | build a source-grounded visual brief and verify code/config semantics before rendering |
| Reference-vs-production labeling | MCP official-source warning | partial evidence-type labels | KEEP/IMPROVE | explicit UI and prompt contract |

## Current product boundary is not approved

The existing sidebar and screen model are **not** accepted product architecture. UI decisions will be revisited after `workflow-reconstruction.md`, `feedback-matrix.md`, and `competitive-matrix.md` are complete.
