# Creator Console Evidence Ledger v1

Researched: 2026-10-06

This ledger separates product facts, community pain points, creator reference patterns and inferences. It is intentionally incomplete rather than speculative.

## A. Community pain points

| ID | Evidence class | Source | Observed signal | Confidence | Product implication |
|---|---|---|---|---|---|
| CP-01 | community | Reddit /r/Entrepreneurs — `I was getting generic AI LinkedIn posts...` | Template-first AI tools still require the user to invent the idea. The author reversed the flow: ingest what the user is already reading, ask for their opinion, then draft from that answer. | Medium | Creator Console should begin from research/inspiration and request the creator's take before drafting. |
| CP-02 | community | Reddit /r/ProductivityApps — `ai writing tools I use pretty much every day` | Users split research, source checking and drafting across tools. Multiple commenters explicitly dislike copy/paste between ChatGPT and the document being written. | High for pain signal | Research, sources, drafting and revision should share one persistent workspace. |
| CP-03 | community | Same ProductivityApps thread | A commenter reports long-form ChatGPT workflows lose context. | Medium | Context must be durable and inspectable rather than only prompt history. |
| CP-04 | community | Reddit /r/linkedin — `Every single post on LinkedIn is made with AI...` | Strong negative reaction to repetitive AI-shaped LinkedIn writing. | High for sentiment | Generic tone and recognizable AI structures are product failure conditions, not cosmetic issues. |
| CP-05 | community | Reddit /r/linkedin — `Every post on linkedin is Ai` | Users call out repeated wording/punctuation and sameness across posts. | High for sentiment | Critic must include anti-template / anti-sameness checks and require creator-specific perspective. |
| CP-06 | community | Reddit /r/ProductivityApps — clipped/shared content organization thread | Users save LinkedIn posts, web pages, PDFs, screenshots and notes across many places and want one searchable system. | Medium | Research inbox should accept heterogeneous sources and preserve the user's annotation/reaction. |

## B. Competitive product facts

| ID | Evidence class | Source | Observed capability | Confidence | Product implication |
|---|---|---|---|---|---|
| COMP-01 | first-party-public | `https://kleo.so/` | Kleo presents a full LinkedIn system spanning Strategy, Challenge, Inspiration, Styles, Create, Scheduling, Activities, Analytics, Mobile and Community. | High | A viable Creator Console cannot be only a text generator. It needs discovery, creation, publishing and learning loops. |
| COMP-02 | first-party-public | Kleo | Kleo explicitly frames its value as turning scattered ideas into a cohesive content system and creating content in the user's voice/style. | High | Our product must provide a coherent operating model, not a collection of disconnected utilities. |
| COMP-03 | official-doc | `https://taplio.com/linkedin-post-scheduler` | Taplio supports a queue/calendar, best-time scheduling, direct publishing, multiple media formats and company pages. | High | Scheduling and queue management are table-stakes for LinkedIn operating-system positioning, but should follow real content quality and approval. |
| COMP-04 | official-doc | `https://taplio.com/linkedin-analytics-tool` | Taplio maps analytics to suggested next actions rather than showing raw charts only. | High | Our analytics should produce learning recommendations tied back to topic, format and evidence—not merely report metrics. |
| COMP-05 | official-doc | `https://authoredup.com/product/analytics` and help center | AuthoredUp supports performance summaries, post comparison, historical posts, filtering, reuse and analytics. | High | Library + comparative analytics + repurposing should be in scope once publication data is real. |
| COMP-06 | official-doc | AuthoredUp platform/editor docs | AuthoredUp's platform editor has LinkedIn-specific limitations and sometimes hands control back to LinkedIn. | High | Creator Console needs explicit capability boundaries and must not pretend platform APIs support things they do not. |
| COMP-07 | first-party-public | `https://type.ai/` | Type integrates document editing and AI in the same workspace, retains rich context/notes, supports style rules, version history and exports. | High | Editing should be first-class and persistent; AI should operate on the artifact in place rather than through a separate chat-only workflow. |

## C. Creator/reference pattern evidence

These are structural references only; they cannot support factual claims unless independently verified.

| ID | Evidence class | Source | Pattern learned | Product implication |
|---|---|---|---|---|
| REF-01 | reference-pattern | Ajeya Krishna LinkedIn post supplied by user | quantitative hook → challenge assumption → technical architecture / benchmark discussion | Support benchmark-led technical explainers, but require independent benchmark provenance. |
| REF-02 | reference-pattern | Dash DesAI Snowflake Cortex Agents post supplied by user | announcement → feature breakdown → production implication → official source | Provide a product-update teaching template grounded in release notes/docs. |
| REF-03 | reference-pattern | Patrick Wendell Databricks model-rollout post supplied by user | first-party operational story → controls → evaluation → rollout decision | Prefer engineering-operating-model stories over generic launch summaries. |
| REF-04 | reference-pattern | Yash V. FDE / Agentic AI question map supplied by user | question taxonomy → production judgment → breadth organized into a reusable guide | Support multi-part guides and learning-series creation from broad technical taxonomies. |
| REF-05 | reference-pattern | Nick Akincilar corpus already in repo | comparison, architecture, product update, diagrams, implementation artifacts | Visual/diagram and runnable-example generation should be part of the content artifact, not an afterthought. |

## D. Existing donor-code facts

| ID | Evidence class | Source | Observed implementation | Assessment |
|---|---|---|---|---|
| DONOR-01 | official-source | `creator-console/lib/research-agent.js` | Crawls official OpenAI, Anthropic, Snowflake and Databricks surfaces; enriches primary pages; ranks and diversifies. | KEEP as donor candidate; source coverage and ranking need behavior contracts. |
| DONOR-02 | official-source | `creator-console/lib/context.js` | Deterministically retrieves expertise, evidence, prior content and `style-only` reference patterns. | KEEP concept; retrieval quality and durable-memory behavior need stronger tests. |
| DONOR-03 | official-source | `creator-console/app.js` | Implements Today → Research → Create → Library → Capabilities → Memory → Agent Runs. | REASSESS. Navigation was designed before clean-room workflow reconstruction. |
| DONOR-04 | official-source | `creator-console/db/schema.sql` | Defines profiles, research items, drafts and publications with service-role-only access. | KEEP as starting schema; missing evidence objects, feedback/metrics, source snapshots and content-series relationships. |
| DONOR-05 | official-source | `creator-console/tests/*` | Unit tests cover approval, context, harness, product and research agent behavior. | KEEP but do not call product certified; comparative UAT is absent. |

## E. Derived product inferences

| ID | Evidence class | Derived from | Inference | Status |
|---|---|---|---|---|
| INF-01 | inference | CP-01, CP-02, COMP-01, COMP-07 | The primary unit of work should be a persistent `Content Brief`, not a blank prompt or a raw post draft. | ADOPT |
| INF-02 | inference | CP-04, CP-05, REF-01..05 | `Your Take` must be a required authored input for opinion/analysis posts unless the artifact is explicitly factual/educational only. | ADOPT |
| INF-03 | inference | COMP-03, COMP-04, COMP-05 | The system is incomplete without queue/publishing/analytics, but these should be downstream of evidence and quality gates. | ADOPT |
| INF-04 | inference | REF-05, COMP-01 | Content artifacts should support text + diagram/carousel/code/example briefs, not text alone. | ADOPT |
| INF-05 | inference | CP-02, CP-03, COMP-07 | Context/memory and revision must live beside the artifact and persist across sessions. | ADOPT |
| INF-06 | inference | all above | Differentiation is not “AI LinkedIn writer.” It is `technical creator operating system: primary-source research → creator point of view → evidence-backed artifact → multi-format publishing → learning loop`. | PROVISIONAL THESIS |

## Source URLs

- https://www.reddit.com/r/Entrepreneurs/comments/1tjqqpm/i_was_getting_generic_ai_linkedin_posts_so_i/
- https://www.reddit.com/r/ProductivityApps/comments/1wtiouj/ai_writing_tools_i_use_pretty_much_every_day/
- https://www.reddit.com/r/linkedin/comments/1ny5gsv/every_single_post_on_linkedin_is_made_with_ai_and/
- https://www.reddit.com/r/linkedin/comments/1wkrt83/every_post_on_linkedin_is_ai/
- https://bg.reddit.com/r/ProductivityApps/comments/1u9fvgi/app_for_orgnizing_clipped_or_shared_content_fom/
- https://kleo.so/
- https://taplio.com/linkedin-post-scheduler
- https://taplio.com/linkedin-analytics-tool
- https://authoredup.com/product/analytics
- https://help.authoredup.com/articles/how-to-use-analytics
- https://help.authoredup.com/articles/authoredup-on-platform
- https://type.ai/
