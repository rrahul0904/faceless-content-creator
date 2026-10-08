# Creator Console Capability Matrix v1

Decision vocabulary:
- MATCH — expected by the market; implement credibly.
- IMPROVE — existing pattern is useful but we need a materially better behavior.
- NEW — differentiated capability justified by our technical-creator target.
- OMIT — intentionally out of scope.
- INVESTIGATE — evidence insufficient.

| Capability | Competitive evidence | User evidence | Decision | Creator Console target behavior |
|---|---|---|---|---|
| Inspiration / discovery feed | Kleo strategy/inspiration; Taplio content planning | blank-page complaints | IMPROVE | Research-first queue built from primary technical sources + community questions, ranked by educational value and evidence readiness. |
| Manual capture | Productivity users save content across LinkedIn/web/PDF/screenshots | scattered-source pain | MATCH | Save URL/file/note into one research inbox with annotation and source class. |
| Primary-source research | General tools split research/source checking from drafting | users use Perplexity/Gemini separately | NEW | Claim ledger, primary-source priority, contradiction/uncertainty handling, technical mechanics extraction. |
| Long-form source repurposing | ThreadifyAI maker launch describes YouTube URL → extracted hooks → LinkedIn/Twitter social output | user supplied ThreadifyAI as a relevant comparison | MATCH + IMPROVE | Accept long-form URL/media/transcript as a source, extract candidate hooks/claims, then transform into platform artifacts without losing Content Brief identity. |
| Source-segment provenance | ThreadifyAI launch feedback explicitly asks for source passage → hook → carousel comparison and timestamp traceability | aligns with user's evidence-first reverse-engineering requirement | NEW | Every media-derived factual claim/hook retains source ID plus passage/timestamp/segment where available; side-by-side inspection is required before evidence-backed publication. |
| Creator point of view | Ghostlio-style approach asks what user thinks | generic-template complaints | IMPROVE | Required thesis for analysis/opinion; explicit distinction between facts, creator opinion and inference. |
| Voice/style memory | Kleo, Type.ai, many AI writers | AI sameness complaints | IMPROVE | Author-owned voice rules + prior content + explicit allowed claims; reference creators remain style-only. |
| In-place editor | Type.ai deeply integrates draft + assistant | copy/paste pain | MATCH | Persistent editor with selected-text rewrite, source sidebar, claim inspector and version history. |
| AI drafting | broadly available | not the core pain by itself | MATCH | Channel-native drafting from the Content Brief; no generic blank-prompt generation as default. |
| Separate critic/revision | multi-step creator tools; donor harness | generic AI output complaints | IMPROVE | Critic evaluates evidence, creator specificity, AI-template risk, channel fit, similarity and technical usefulness. |
| LinkedIn scheduling/queue | Taplio | consistency pain | MATCH | Calendar/queue after approval; scheduling never bypasses content approval. |
| LinkedIn direct publishing | Taplio and native LinkedIn | copy/paste friction | MATCH | Direct publish when supported/authorized, exact-content receipt, safe failure handling. |
| Medium publishing | platform capability uncertain/restricted | user wants Medium too | INVESTIGATE | Use supported API/export/browser workflow only; no fake integration. |
| Analytics | Taplio, AuthoredUp | users want feedback on what works | IMPROVE | Compare similar posts and generate cautious next-action hypotheses tied to topic/format/evidence. |
| Historical library / reuse | AuthoredUp | recurring need to reuse strong work | MATCH | Search/filter drafts and published artifacts; reuse structure or update facts without copying stale claims. |
| Visual technical artifacts | Kleo supports broader content system; creator references are diagram/comparison-heavy; ThreadifyAI launch is carousel-oriented | technical content benefits from architecture visuals | NEW | Diagram/carousel/code-example planning and generation tied to the same evidence packet and source provenance. |
| Technical series planner | little direct evidence in compared tools | broad FDE/AI taxonomies naturally exceed one post | NEW | Split large themes into coherent multi-part series with dependency/order and non-repetition controls. |
| Claim-level evidence inspector | not prominent in compared LinkedIn tools | credibility/source-checking pain | NEW | Every factual claim can show supporting source(s), confidence and unresolved caveats. |
| Community-question miner | not core in compared tools | Reddit comments reveal objections/questions | NEW | Mine questions/objections separately from facts; use them to choose angles and FAQs. |
| Automated engagement/comments | some LinkedIn growth products may include engagement automation | not required for core educational-content job | OMIT for v1 | No automated commenting/engagement. Focus on content quality and publishing. |
| CRM / lead automation | Taplio markets broader growth tooling | not core to technical publishing | OMIT for v1 | Track content performance, not sales CRM. |
| Full social-network coverage | ThreadifyAI and many social tools are multi-network | user explicitly prioritizes LinkedIn + Medium | OMIT for v1 | Keep adapter boundaries extensible; do not dilute v1 beyond LinkedIn + Medium solely because competitors support X/Threads. |

## Differentiation boundary

Creator Console will not compete by promising more AI-written posts or faster opaque URL-to-post conversion.

It will compete on:

1. technical-source discovery,
2. claim/evidence quality,
3. source-segment provenance for repurposed material,
4. creator-specific judgment,
5. artifact choice (text, visual, code, comparison, series),
6. channel-native production,
7. exact approval/publishing receipts,
8. evidence-backed learning from published work.

## Existing donor-code disposition

| Donor subsystem | Decision | Reason |
|---|---|---|
| Official-source crawler | KEEP + IMPROVE | aligns with evidence-first discovery but source universe must expand and snapshot provenance must persist. |
| Evidence gate | KEEP + IMPROVE | correct fail-closed principle; needs claim-level model and richer evidence classes. |
| Context retriever | KEEP + IMPROVE | useful separation of author-owned/evidence/style-only; durable memory and retrieval evaluation missing. |
| Writer/critic harness | KEEP + IMPROVE | correct multi-stage pattern; critic dimensions need clean-room acceptance criteria. |
| Current navigation/UI | INVESTIGATE | created before workflow reconstruction; must be tested against Content Brief state model. |
| Browser-local fallback memory | OMIT as normal mode | acceptable emergency fallback, not target product behavior. |
| DB schema | KEEP + EXTEND | useful base tables; missing briefs, claims, evidence snapshots, source segments/timestamps, series, metrics and learning hypotheses. |
