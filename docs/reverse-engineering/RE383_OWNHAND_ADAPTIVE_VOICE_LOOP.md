# RE-383 — Ownhand donor → Adaptive Voice Loop

Status: **Phase A implementation candidate — clean-room capability donor**

Canonical destination: `rrahul0904/faceless-content-creator/creator-console`

## 1. Source manifest

Supplied source:
- https://www.reddit.com/r/vibecoding/comments/1wxhexo/built_an_mcp_tool_called_ownhand_it_learns_your/

Public first-party evidence:
- https://ownhand.dev/
- https://github.com/jordan-gibbs/ownhand
- https://github.com/jordan-gibbs/ownhand/blob/main/AGENTS.md
- https://github.com/jordan-gibbs/ownhand/blob/main/skills/ownhand/SKILL.md

Additional public feedback reviewed:
- Ownhand crosspost/discussion in `r/AIAgentsInAction`
- Ownhand crosspost/discussion in `r/aipromptprogramming`
- Ownhand crosspost/discussion in `r/ClaudeCode`
- Ownhand crosspost/discussion in `r/VibeCodeDevs`

Evidence date: 2026-10-04.

## 2. Evidence labels

- **Observed** — visible in supplied Reddit post or public first-party docs/repo.
- **Corroborated** — independently visible in more than one public surface.
- **Feedback** — attributable public commenter/product-author statement.
- **Inferred** — our clean-room architecture/product recommendation, not an upstream implementation claim.
- **Unknown** — private implementation or behavior not established by public evidence.

## 3. Product problem and workflow

### Observed problem

Static style instructions and generic AI rewriting drift away from how a person actually writes in different situations. Ownhand positions a persistent writing-style layer between an agent and the final message.

### Observed user loop

1. The user has a draft/message to send under their own name.
2. The agent invokes a writing tool with an occasion/domain and optional recipient/thread context.
3. The service returns a rewrite and a request identifier.
4. The user reviews it and may send unchanged, edit it, or reject it.
5. The agent reports the exact outcome and, for edits, the exact final text actually sent.
6. The style system performs an asynchronous learning pass and can accumulate rules over time.
7. Later rewrites use the updated style state.

### Observed setup loop

Public docs describe creating a “Hand” from real user-authored samples. The docs mention either pulling roughly 20 sent email/chat examples with user approval or pasting 5–10 examples; fewer samples work but are expected to sound more generic.

## 4. Verified capability inventory

Public docs/repo establish the following contract-level features:

- remote streamable-HTTP MCP endpoint;
- OAuth-based connection flow;
- rewrite tool with named occasions/domains;
- reply/thread context and recipient context;
- approved / edited / rejected feedback outcomes;
- exact sent-text feedback for edited content;
- style card, learned rules and sample counts;
- custom occasions;
- recipient/person-specific context;
- pin/reject/activate rule controls;
- versioning / rollback controls;
- user review before send/post;
- explicit opt-out behavior;
- account/billing surface.

The public repository documents these contracts and client setup. It does **not** expose the proprietary hosted learning implementation.

## 5. Privacy / architecture evidence

First-party docs state that the hosted product stores account state, Hands/samples/style/rules, requests and feedback, and limited tool-call metadata. They state thread context is not durably stored. The docs also disclose that hosted writing/learning uses an external model/provider route and warn against submitting sensitive content.

Clean-room implication: our product should not require a third-party style service to provide deterministic profile/rule/tic/holdout functionality. Model-assisted rule induction, if added later, must be provider-neutral and explicitly surfaced.

## 6. Public feedback audit

### Feedback A — repeated phrase / tic detection

A public discussion asks for an “opposite list” of phrases or habits the writer overuses. The discussion converges on an important UX rule: **show counts/evidence before suggestions**, because suggested replacements can themselves become repetitive habits.

Requirement:
- deterministic repeated n-gram/tic counts;
- evidence first;
- alternatives only as a later optional layer.

### Feedback B — benchmark against simpler baselines

A public discussion notes that previous-message retrieval/vector search plus few-shot prompting is a common alternative.

Requirement:
- compare adaptive rules against:
  1. static style instructions;
  2. few-shot/prior-content retrieval;
  3. adaptive rule state;
- do not claim superiority without held-out evidence.

### Feedback C — preserve untouched domain samples

A public discussion recommends keeping untouched examples per writing domain to detect whether accumulated rules flatten or distort casual voice.

Requirement:
- explicit `holdout` sample flag;
- holdout samples excluded from learning evidence;
- domain-specific evaluation before promoting a learned-rule configuration.

### Feedback D — low-signal/bot discussion

One crosspost contained no material independent product feedback. No requirements are invented from it.

### Child-project audit

No commenter-linked separate product was identified. Reddit related/recommended posts are not treated as comment-derived projects.

## 7. Competitive / alternative model

The product hypothesis must survive comparison with simpler approaches:

| Approach | Strength | Weakness | Our benchmark role |
| --- | --- | --- | --- |
| Static voice card | simple, inspectable | does not learn from edits | baseline A |
| Few-shot prior-content retrieval | grounded in real writing | can be context-heavy; may copy wording | baseline B |
| Adaptive rule loop | compact persistent learning | can overfit/flatten style | candidate C |

Phase A does **not** claim candidate C is best. It only creates the auditable machinery required to measure it.

## 8. Dedupe / canonical mapping

Do not create an independent Ownhand-like SaaS repository.

Creator Console already owns:
- `identity` and static `voice { tone, dos, donts, examples }`;
- author expertise and knowledge retrieval;
- prior-content retrieval;
- style-only reference patterns;
- LinkedIn/Medium platform contracts;
- evidence gates;
- writing → critique → revision state machine;
- approval-required publishing;
- run receipts;
- durable profile/draft/publication storage.

Missing capability:

`review/edit outcome → durable learning evidence → governed voice rule → later context`

Therefore RE-383 is a **capability donor** into Creator Console.

## 9. Clean-room boundary

Allowed:
- publicly observable workflow and documented tool contracts as requirements evidence;
- independently authored contracts/data models/tests;
- generic MCP patterns/protocol integration later;
- public feedback converted to product acceptance criteria.

Not allowed / not claimed:
- copying private service code, prompts, classifiers, rule induction logic or data;
- using Ownhand branding/assets as our product identity;
- claiming hosted-service parity from docs alone;
- inferring hidden implementation from public tool names.

## 10. Product improvement matrix

| Capability | Decision | Reason |
| --- | --- | --- |
| Occasion/domain-aware style | MATCH | core useful workflow |
| Approved/edited/rejected feedback | MATCH | necessary learning signal |
| Exact final-text feedback | MATCH | strongest user preference evidence |
| Rule lifecycle + rollback | MATCH | prevents invisible drift |
| Approval before publish | MATCH | already enforced by Creator Console |
| Tic detector | IMPROVE | feedback-derived evidence-first UX |
| Per-domain holdouts | IMPROVE | guards against style collapse |
| Static/few-shot/adaptive benchmark | IMPROVE | proves whether learning adds value |
| Provider-neutral/local deterministic evaluation | IMPROVE | lowers privacy/vendor dependence |
| Separate factual evidence from style rules | IMPROVE | prevents style layer changing truth claims |
| Automatic sending without approval | OMIT | violates existing approval boundary |
| Proprietary hidden learning parity | UNKNOWN/OMIT | no public implementation evidence |

## 11. Phase plan

### Phase A — deterministic adaptive-voice substrate

Implemented scope:
- `creator-console/lib/voice-learning.js`;
- versioned profile/sample/rule/feedback contracts;
- holdout partition;
- feedback hashes and deterministic edit metrics;
- support-threshold rule activation;
- pinned/rejected rule semantics;
- counted repeated phrase/tic evidence;
- deterministic holdout evaluation scaffold;
- active/pinned domain rules injected into `creator-context-packet/v2`;
- guardrail stating voice rules may shape expression, not facts;
- focused Node tests.

Intentionally absent:
- LLM rule induction;
- persistence/schema changes;
- APIs/UI;
- MCP server;
- third-party message import;
- automatic send/publish;
- hosted Preview/UAT.

### Phase B — persistence and receipts

- Supabase tables for profiles/samples/rules/feedback/evaluations;
- immutable feedback/learning receipts;
- API endpoints;
- retention/deletion controls;
- profile version/rollback persistence.

### Phase C — measured adaptive induction

- provider-neutral model-assisted rule proposals;
- explicit-reason weighting;
- bounded feedback windows;
- activation only after support + holdout gates;
- baseline benchmark against static and few-shot retrieval;
- reject rule sets that worsen holdout/tic metrics.

### Phase D — Creator Console UX + optional MCP

- Voice workspace;
- sample/holdout management;
- rule state controls;
- tics dashboard;
- post-edit feedback capture;
- optional MCP facade that preserves existing approval/evidence gates.

### Phase E — release evidence

- exact-head CI;
- browser UAT for LinkedIn and Medium;
- data deletion/retention verification;
- hosted Preview exact-head proof;
- only then production/deployment claims.

## 12. Phase A acceptance contract

Must prove:

1. holdouts never enter learning evidence;
2. proposed/rejected rules never enter writing context;
3. active/pinned rules are domain-scoped;
4. global rules can apply across domains;
5. feedback receipt records deterministic draft/final hashes and change metrics;
6. explicit reason can count as strong evidence without duplicating support on replay;
7. rule rejection is sticky under further support attempts;
8. tic output contains counted evidence before suggestions;
9. context guardrails keep learned voice separate from factual/evidence truth.

## 13. Evidence status

As of this document:
- source research: **complete for accessible public surfaces**;
- comment/feedback audit: **complete for accessible public crossposts**;
- canonical repo/dedupe: **verified**;
- Phase A source: **authored on RE-383 branch**;
- local/CI tests: **not claimed until executed**;
- Preview/browser UAT: **not run / not claimed**;
- production: **unchanged**.
