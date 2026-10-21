# REA Loudcode public-reference dossier — engineering update evidence bridge

Intake: 2026-10-21. **DONOR/CAPABILITY EXTENSION**, not an independent clone or a new repo.
Canonical governance: https://github.com/rrahul0904/agent-work-os/issues/357 ; Creator product: https://github.com/rrahul0904/faceless-content-creator/issues/44.

## Source and licensing boundary
- Reddit original: https://www.reddit.com/r/SideProject/comments/1xble5g/i_built_an_app_that_markets_my_app_from_its_code/
- Vendor: https://loudcode.dev/ ; public docs https://loudcode.dev/docs ; demo https://loudcode.dev/demo
- GitHub docs https://loudcode.dev/docs/connect-github ; drafting https://loudcode.dev/docs/how-drafts-work ; AI tool list https://loudcode.dev/docs/mcp-tools
- Publicly described capabilities: read-only selected-repo commits, merged PRs and releases; Stripe/Polar/RevenueCat/PostHog signals; drafts, X scheduling, week check-in, idea bank, voice/tone rules, MCP draft/list/queue/metrics actions.
- LinkedIn and Bluesky are **coming soon**, not verified live.
- Vendor source, prompts, schemas, production architecture, security, customer adoption and revenue are unknown. Same-name GitHub repositories are **not** confirmed upstream. No vendor proprietary source was inspected. Terms of service prohibit service reverse engineering; this design derives only from publicly documented user-facing concepts with independent code, not protected implementation.

## Existing-product fit
- Creator Console in this repository already contains research/context/draft surfaces, media pipeline and signed exact-content approvals under `creator-console/lib/approval.js`.
- DistribPal donor reference product issue #40 / research draft PR #41 focuses on UGC slides and video. This module focuses on **engineering activity → evidence-linked draft**. Integrate later; do not duplicate.
- Agent Work OS keeps verification, approvals, guardrails, research provenance, replay and exact-SHA receipts.

## Proposed end-to-end system

```
Allowed repo GitHub connector (read only; not yet implemented)
   -> independent API-backed commit/PR/release/CI verification
   -> public/private/secret/PII policy gates
   -> deterministic event normalizer/planner [THIS PR]
   -> context/voice rewriting with cited sources and claim check
   -> Creator Console editorial UI + existing signed approval
   -> separate authorized queue/publishing with idempotent receipts
   -> channel metrics + attribution-confidence limits
   -> REA replay / independent audit
```

## Implemented offline Phase A
- `creator-console/lib/engineering-update-planner.js`: CommonJS module `buildEngineeringUpdatePlan(input)`.
- Inputs: `workspaceId`, `projectId`, `repository`, fixed UTC `asOf`, `events`, optional `maxDrafts`.
- Events: `kind` = commit, merged_pr, release; `sha` = full 40-char hash, `sourceUrl` = matching HTTPS github.com repository URL, `title`, `occurredAt`, `visibility:'public'`, `authenticated:true`; merged PR requires `number` and `merged:true`; release requires `tag`.
- Evidence URLs and authentication status are **CALLER ASSERTIONS** in this offline slice. They are not remotely verified. Signed webhook / authorized read-only GitHub connector is REQUIRED before external data can be trusted.
- Rejects private, unauthenticated and cross-repository inputs; suspicious URL domains and query strings; bad hashes, PRs and tags; future timestamps; secret-looking and unsafe title data. Not a comprehensive PII/secret filter.
- Fixed ordering, event de-duplication, workspace-bound IDs, plan digest, conservative summaries. No revenue, user or impact promises. Every output is `needs_review`, `canSchedule:false`, `canPublish:false`, `verification:'source-reported-only'`.
- No source fetching, model calls, provider credentials, external scheduling, SaaS mutation or social posts.
- 23 scoped tests passed. Scoped CI and independent review are separate gates.

## Release ledger
| Gate | Status |
| --- | --- |
| Public source identity and functional extraction | done |
| Ownership/routing, clean-room and product boundaries | done |
| Offline evidence-linked deterministic planner | branch implementation |
| 23 negative/replay fixture tests | locally passing, CI pending |
| Authenticated GitHub connector and webhook/replay controls | pending |
| Creator editorial surface and voice + signed approval integration | pending |
| Consented social queue and metrics + cancellation | pending |
| Tenant/privacy/security and real browser E2E | pending |
| Exact-head CI, production hosting, rollout and rollback receipts | pending |

**Do not publish from the phase-A module.** Require explicit channel authorization and exact-content/asset approval; never post private commits, unsupported impact claims, fabricated product numbers, customers, screenshots or testimonials. Existing repository security audit blocker #37 and durable-hosting blocker #21 remain outstanding, and scoped CI green does not resolve them.

## Independent verification steps
1. `node --check creator-console/lib/engineering-update-planner.js`
2. `node --test creator-console/tests/engineering-update-planner.test.js` (expected: 22 passing)
3. Review exact branch SHA, test URL-owner mismatch, duplicate events, timestamp boundaries, secret filters and no network accesses.
4. Before future connector adoption, test GitHub API response trust, fork/private repo policy, signed webhook replay, deletion/force-push, changes after content approval, cross-tenant access and idempotent output.
5. Before deploy, satisfy release security, dependency audit, browser UX, external account consent, durable queue and independent operator approval.

*Completion truth: offline module only. Not connected, not production-ready, not vendor parity.*
