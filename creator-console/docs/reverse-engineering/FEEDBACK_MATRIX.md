# Creator Console — Competitive & Feedback Matrix

Status: evidence artifact for reverse-engineering reset. This is not a feature wishlist. Each observation is classified by source type and translated into a product implication only where the evidence supports it.

## Evidence rules

- `official-doc` / `first-party-public`: may establish the observable capability of a product.
- `community`: may establish user-reported pain, preference, concern, or workflow; it does not establish product facts by itself.
- `reference-pattern`: may inform presentation/content structure only.
- Competitive claims that are not directly observed remain `INVESTIGATE`.

## Product capability observations

| Product / source | Evidence class | Observed capability | Limit / caveat | Creator Console implication |
|---|---|---|---|---|
| Taplio — LinkedIn Post Scheduler (`https://taplio.com/linkedin-post-scheduler`) | first-party-public | Queue, visual calendar, best-time suggestions, direct publishing, profile/company-page scheduling, media/carousel scheduling | Vendor claims about reach/best-time effectiveness are not independently validated here | Scheduling is commodity/MATCH, not our primary differentiator. We need an approval-bound queue later, not a novel scheduler first. |
| Taplio — Analytics (`https://taplio.com/linkedin-analytics-tool`) | first-party-public | Follower/reach/engagement trends, top-post surfacing, recommendations/recycling | Causal language such as what “drives” growth needs careful treatment | Analytics belongs after publication receipts. Prefer hypothesis generation over causal claims. |
| Taplio — Creator workflow (`https://taplio.com/individual-creators`) | first-party-public | Inspiration corpus, AI post ideas/generation, engagement tooling, analytics | Broad all-in-one scope; not evidence that output is distinctive/authentic | Do not compete on generic generation breadth. Differentiate on technical evidence and creator judgment. |
| AuthoredUp — Editor (`https://authoredup.com/product/editor`) | first-party-public | Editor, hooks/readability, drafts, calendar, published-post history, analytics, saved posts | Product spans multiple workflow stages | Rich editing/history is a MATCH requirement for later slices. |
| AuthoredUp — Platform editor guide (`https://help.authoredup.com/articles/authoredup-on-platform`) | official-doc | Central editor/content analytics | Platform editor cannot directly tag profiles; direct scheduling/publishing requires the LinkedIn-side extension/workflow | Publishing adapters must expose real platform constraints rather than presenting a fake universal composer. |
| AuthoredUp — Analytics (`https://help.authoredup.com/articles/how-to-use-analytics`) | official-doc | Period comparisons, impressions, reactions, comments, shares, engagement rate | Analytics interpretation still requires judgment | Preserve raw publication metrics separately from learned hypotheses. |
| AuthoredUp — analytics discrepancy (`https://help.authoredup.com/articles/different-data-between-linkedin-and-authoredup`) | official-doc | Documents collection/update behavior and explains discrepancies from LinkedIn | Third-party metrics can lag or use different aggregation windows | Analytics provenance must include collection time/source and never imply perfect parity. |
| AuthoredUp — data import (`https://help.authoredup.com/articles/how-import-your-linkedin-data-export`) | official-doc | Imports LinkedIn archive/public posts without requiring extension for basic history | Export has limited metrics; richer stats require collection path | Content history/import is useful for creator memory, but provenance and metric completeness must be visible. |

## Community feedback / pain signals

| Community source | Evidence class | User-reported signal | Confidence | Product implication |
|---|---|---|---|---|
| r/microsaas — “AI content tool opposite of what exists” (`https://www.reddit.com/r/microsaas/comments/1s4d6ti/im_building_an_ai_content_tool_thats_the_opposite/`) | community | Generic voice, lack of research-backed content, and copy-machine generation are presented as core pain | Medium — founder/researcher self-report, small thread | Require creator perspective + evidence before drafting. Generic topic→post generation must not be the default workflow. |
| r/ProductivityApps — daily AI writing tools (`https://www.reddit.com/r/ProductivityApps/comments/1wtiouj/ai_writing_tools_i_use_pretty_much_every_day/`) | community | Research/source tools and drafting tools are separate; in-editor AI reduces copy/paste friction | Medium | Research and editor need one shared Content Brief/context, not export/import between internal modules. |
| r/AIToolsAndTips — tools that stuck (`https://www.reddit.com/r/AIToolsAndTips/comments/1vf8k9h/the_ai_writing_tools_that_actually_made_it_into/`) | community | Credible-source lookup plus an editor with contextual AI are complementary recurring tools | Medium | Research Workbench and editor should share provenance and selection state. |
| r/AIToolMadeEasy — best AI writing tool (`https://www.reddit.com/r/AIToolMadeEasy/comments/1wwkwal/best_ai_writing_tool_that_isnt_chatgpt/`) | community | Tone/context/editing and workflow matter more than another chatbot; users mention tool fragmentation | Medium | Avoid chat-first UX. Use object-first workbench/editor with bounded AI actions. |
| r/ProductivityApps — AI that learns style (`https://www.reddit.com/r/ProductivityApps/comments/1tltc02/writing_ai_that_learns_your_style_does_anything/`) | community | Re-explaining context and tool switching consume writing time; embedded context is valued | Medium | Context should be retrieved automatically from the Content Brief, creator memory, and prior artifacts. |
| r/BookWritingAI — Type.ai review (`https://www.reddit.com/r/BookWritingAI/comments/1rjqnm7/typeai/`) | community | Deep-context tools can become expensive/opaque in usage | Low/Medium — individual usage report | Later editor must expose model/run cost and bounded context selection rather than hiding unlimited-looking consumption. |
| r/AIWritingHub — Type.ai substitute (`https://www.reddit.com/r/AIWritingHub/comments/1udas2t/asking_for_a_substitution_of_typeai/`) | community | Similar concern about rapid credit usage despite workflow quality | Low/Medium | Cost/usage transparency is an acceptance criterion for model-backed editing. |
| r/linkedin — Taplio discussion (`https://www.reddit.com/r/linkedin/comments/16zcpmy/any_one_not_using_taplio/`) | community | Users value inspiration/scheduling but some express account/compliance concerns around automation | Low/Medium — mixed anecdotal thread | Prefer official platform APIs and explicit approval; do not depend on session-cookie/browser automation for publishing. |
| r/SaaS — Kleo extension shutdown (`https://www.reddit.com/r/SaaS/comments/1lj4dfi/`) | community | Users valued viral-post/content ideation; shutdown discussion raises platform-dependency risk | Medium for workflow value, low for exact cause | Inspiration/search is useful, but product architecture must not depend on scraping LinkedIn as a critical path. |
| r/digital_marketing — workflow after Kleo (`https://www.reddit.com/r/digital_marketing/comments/1pgf1lr/kleo_shutting_down_totally_messed_up_my_linkedin/`) | community | One user describes falling back to Notion + ChatGPT + spreadsheets + LinkedIn and losing consistency | Low/Medium | The OS value proposition is workflow continuity across research, brief, draft, approval and history. |

## Reconstructed jobs that are underserved

### Job 1 — Decide what is actually worth teaching
Existing inspiration products help find popular posts. Our evidence suggests a technical practitioner needs a different filter:

- primary-source freshness;
- architectural significance;
- evidence sufficiency;
- audience fit;
- novelty relative to prior content;
- whether the creator has a real point of view.

### Job 2 — Turn research into a defensible claim set
This is not strongly solved by the observed LinkedIn creator tools. Creator Console should make this first-class:

1. capture source;
2. classify evidence;
3. extract/enter claims;
4. link each factual claim to support;
5. show disputes/unresolved gaps;
6. separate community questions from facts;
7. separate creator opinion from factual premises.

### Job 3 — Preserve context while moving from research to writing
Community reports repeatedly value fewer context switches. The Content Brief therefore owns the shared context. Research, planning, drafting and review operate on the same object rather than passing plain text between isolated agents.

### Job 4 — Publish without unsafe automation
Scheduling itself is not novel. The important boundary is:

`approved immutable draft → official platform adapter/export → publication receipt`

No cookie/session scraping, no silent publish, no approval inferred from generation.

### Job 5 — Learn without inventing causality
Existing products surface winning posts and recommendations. Creator Console should distinguish:

- observed metric;
- comparison window;
- content attributes;
- hypothesis;
- next experiment;
- confidence.

“Post X caused growth because of hook Y” is not permitted unless the evidence supports that causal conclusion.

## Differentiation decision

Creator Console will **not** try to win by being another LinkedIn AI generator, viral-post search database, generic scheduler, or engagement dashboard.

The clean-room differentiation is:

> Primary-source technical research + claim-level provenance + creator judgment + artifact planning + integrated editing + approval-bound publishing + evidence-aware learning.

## Explicit non-decisions / investigate

The following remain unresolved and must not be implemented based on assumption:

- whether visual/carousel generation should be native rendering or export to an external design surface;
- whether Medium should remain export-only or use a browser-assisted workflow;
- which LinkedIn analytics can be retrieved reliably through official APIs for this account/use case;
- whether importing LinkedIn archive/history materially improves creator-memory retrieval enough to justify the workflow;
- how much automated claim extraction users trust before requiring manual confirmation.
