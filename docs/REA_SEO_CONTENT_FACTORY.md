# REA SEO Content Factory — donor study and governed prototype

## Source-of-truth / classification
- Intake: https://www.reddit.com/r/n8n/comments/1xakck5/
- MIT donor: https://github.com/cuebicai/n8n-workflows/tree/main/seo-content-writing
- Inspect SHA (Git blob): workflow.json \`6cd35d3359505b6259793939091c85b26948f3f0\`; sub_workflow.json \`7569aece19c7789a55c2e5e41834bbd8ec41f46a\`.
- Agent Work OS: https://github.com/rrahul0904/agent-work-os/issues/361
- Product issue: https://github.com/rrahul0904/faceless-content-creator/issues/46
- Classification: **DONOR_REFERENCE / MODULE** within existing Creator Console. Architecture independently implemented; no donor JSON, secrets, prompts or generated media copied into this repository.

## Findings (inspected upstream, not claims of local deployment)
The main n8n workflow has 33 nodes and 28 connection-entry nodes: a webhook, Airtable inputs and statuses, model planner/writer, Perplexity research, section loop, image-generation agent, and article storage. The separate image workflow has 7 nodes, calls an OpenRouter image model and posts to ImgBB. Main workflow is inactive in the inspected source.

Risks:
1. \`$getWorkflowStaticData('global').article_so_far\` is workflow-scoped and not keyed by tenant/article, creating concurrency and accidental content-mixing risk. An inline comment incorrectly calls it per execution.
2. No independently demonstrated claim-verification, real URL retrieval, human signed outline approval, per-section durable replay, or token budget gates.
3. Airtable base IDs, external workflow IDs, and provider credentials are environment-specific; upstream JSON import alone is not deploy-ready.
4. Single demonstration runtime/tokens (28m / 636,964) are self-reported, not independently reproducible cost/quality benchmarks.

## Proposed system

\`\`\`mermaid
flowchart TD
 A[Workspace topic, keyword, audience] --> B[Validated evidence packet]
 B --> C[Outline and section source mapping]
 C --> D{Signed human outline approval?}
 D -- No --> HOLD[Hold for review]
 D -- Yes --> E[Section-scoped model adapter]
 E --> F[Allowed citation and quality checks]
 F --> G{All sections valid?}
 G -- No --> FAIL[Quality failed, never publish]
 G -- Yes --> H[Editorial review required]
 H --> I{Separate publication approval?}
 I -- No --> HOLD2[Hold publication]
 I -- Yes --> PUB[Future export/publish adapter]
\`\`\`

## Implemented slice (draft-only)
- \`creator-console/lib/seo-article.js\`: deterministic run digest includes workspace and source packet; guarded 2–40 source/2–12 section contract; HTTPS evidence links and per-section source allowlist; cryptographically signed outline receipt via existing Creator Console HMAC utility; no executable model/network dependencies; fail-closed when provider adapter missing; no global article buffer; quality gate blocks unsupported or absent markdown citations.
- \`creator-console/api/seo-article.js\`: POST-only, server-side \`CREATOR_SEO_API_KEY\` (>=24 characters), \`CREATOR_APPROVAL_SECRET\`; operator-confirmed signing request and preview; never publishes or sends to models. Endpoint is reachable only if the Creator Console deployment uses its \`creator-console/\` project root.
- \`creator-console/tests/seo-article.test.js\`: unit cases for approval, evidence, citations, tamper detection, isolation and provider failure.
- All evidence is **user-supplied and not fact checked**. A passing citation check proves a link matches the approved packet, **not that the linked source supports the claim**.

## Local quick check
\`\`\`bash
cd creator-console
node --test tests/seo-article.test.js
# Or run the existing test suite:
npm test
\`\`\`

To use the preview endpoint, set \`CREATOR_SEO_API_KEY\` and \`CREATOR_APPROVAL_SECRET\` as operator-owned secrets. POST \`/api/seo-article\` with \`x-creator-seo-key\` and JSON \`{"op":"preview","input":{...}}\`. This returns \`outline-approval-required\`; after a real operator reviews the outline, POST \`{"op":"approve-outline","reviewAcknowledged":true,"input":{...}}\` and pass the returned \`outlineApproval\` into the input. With independently supplied \`sectionDrafts\`, a passing run returns \`editorial-review-required\`. Never use the sign endpoint as a substitute for an actual review.

## Do not claim completion without
1. Real authorized research adapters, safe source fetching, prompt-injection resistance, citation/claim verification, relevance/freshness checks.
2. Workspace-scoped Postgres jobs/sections, optimistic writes, idempotency keys, retries, execution leases, provenance and crash-recovery replay.
3. Model choice, token/cost/timeout ceilings, provider billing instrumentation, cancellation and quality benchmarks.
4. Rights-checked image generation/storage, accessible captions/alt text, editor UI, metadata/schema/duplicate SEO checks.
5. Real human identity + signed outline and publication receipts, editor export/import, optional publishing/analytics.
6. Exact-SHA CI (unit/integration/tenant isolation/contract), authorized staging E2E, security QA and gated release.
7. Verification of existing blocker issues including durable hosting and dependency vulnerabilities; no merge/deploy without review.
