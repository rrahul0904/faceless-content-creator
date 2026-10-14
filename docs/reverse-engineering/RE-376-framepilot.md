# RE-376 — Framepilot capability donor

## Sources
- Reddit origin: https://www.reddit.com/r/SideProject/s/CHUoB8DG69
- Product: https://framepilot.site
- Publishing surface: https://publish.framepilot.site

## Public product map
Framepilot presents a faceless short-video workflow built around topic-to-script generation, sentence-level visual matching, narration, timed captions, vertical video rendering, review/download/scheduling, recurring content series, and approval before automated publishing.

The creator publicly identifies infrastructure and providers including Clerk, Stripe, Vercel, Neon, Hetzner render workers, OpenAI, Microsoft speech, Pexels, and Wikimedia. Those disclosures are architectural evidence only; this project does not copy private code, branding, or UI.

## Canonicalization decision
Do not create a second product repository. `faceless-content-creator` already owns the script, render, durable-job, workspace, and social-publishing boundaries. Framepilot is a capability donor.

## Gap analysis
| Capability | Existing state | Action |
| --- | --- | --- |
| Script generation | Present | Reuse |
| Render/captions/voice | Present | Reuse |
| Durable render jobs | Present | Reuse |
| Social publishing worker | Present | Reuse |
| Explicit approval gate | Publish path self-approved | Phase 1 |
| Recurring series/cadence | No first-class series model found | Phase 2 |
| Sentence-to-visual sourcing | Existing semantic/render foundations, no Framepilot-like source matching flow | Phase 3 |

## Phase 1 implementation
- Add `POST /api/content/:id/approve`.
- Approval is permitted only from `REVIEW` and requires a rendered video.
- Repeat approval is idempotent.
- `POST /api/content/:id/publish` rejects content that is not already `APPROVED`.
- Generic content PATCH cannot directly assign trusted lifecycle states (`APPROVED`, `SCHEDULED`, `PUBLISHED`).
- Existing workspace ownership, social account validation, usage limits, scheduling, and publisher worker remain in place.

## Follow-on roadmap
### Phase 2 — recurring series
Introduce an explicit series definition, cadence/timezone, next-run calculation, bounded generation queue, pause/resume, per-run approval policy, idempotency, and durable run receipts. Default to approval-required publishing.

### Phase 3 — sentence-to-visual sourcing
Split scripts into timed semantic beats, derive bounded search queries, retrieve permitted stock/public media, rank candidates against each beat, preserve source/provenance metadata, allow user replacement, and feed selected assets into the existing renderer.

## Non-goals
- No Framepilot name, branding, or UI clone.
- No duplicate auth or billing implementation solely to mirror the donor stack.
- No duplicate Relaypost service; use the existing social publisher boundary.
- No unattended production publishing without an explicit policy and verified approval path.
