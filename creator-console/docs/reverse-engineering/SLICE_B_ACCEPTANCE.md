# Slice B Acceptance Contract — Research Workbench

Status: specification only. **Implementation is gated on Slice A durable persistence passing.**

This contract is derived from the reverse-engineering evidence and feedback matrix. It exists so the next implementation cannot drift back into a generic “research card → generate post” workflow.

## User job

> Starting from a technical development, URL, question, saved reference, or long-form source, help me understand what is true, what is uncertain, what practitioners care about, and what I actually want to teach — without forcing me to move evidence among multiple tools.

## Required workbench regions

### 1. Source inbox
Each captured source must visibly show:
- canonical URL;
- publisher/creator;
- evidence class;
- resolution status;
- published/captured time where known;
- snapshot/provenance identifier where available;
- source segment/timestamp provenance where the source is media or a transcript;
- whether it may support factual claims.

A source is never displayed simply as “verified.” The reason/classification must be inspectable.

### 2. Claim ledger
Every claim must have:
- exact claim text;
- claim type (`fact`, `inference`, `creator-opinion`, `author-experience`);
- supporting source IDs;
- supporting source segment/timestamp where applicable;
- evaluated status;
- confidence;
- caveat/dispute note.

The UI must make unsupported claims more visually prominent than supported ones.

### 3. Community questions / objections
Community evidence is stored separately from factual product evidence.

Allowed uses:
- recurring questions;
- reported pain;
- objections;
- vocabulary;
- desired examples;
- confusion points.

Disallowed use:
- silently promoting a Reddit/LinkedIn statement into an authoritative product fact.

### 4. Contradictions and unresolved gaps
The workbench must show:
- claims supported by conflicting evidence;
- claims with no evidence-capable source;
- unresolved shortlinks;
- missing dates/version context;
- missing source timestamp/segment for media-derived claims where traceability is required;
- primary-source fetch/enrichment failures.

No drafting gate may pass while a required factual claim remains unresolved or disputed.

### 5. Creator perspective
The workbench must capture separately:
- `creatorTake` — what the creator thinks;
- `teachingOutcome` — what the reader should understand;
- optional `authorExperience` evidence/input.

Creator opinion must not be rewritten into a factual claim.

### 6. Research-to-plan gate
Research may advance only when:
- required factual/inference claims pass the claim-level evidence gate;
- experience mode has author-owned support;
- unresolved/disputed required claims are either resolved or explicitly excluded from the artifact;
- teaching outcome is non-empty;
- creator perspective is present for analysis/comparison/opinion-led modes;
- media-derived required claims/hooks retain a source passage or timestamp pointer when the source provides one.

## Acceptance scenarios

### B1 — Official announcement + community question
Given:
- official release note saying Feature X is GA;
- Reddit comment asking whether Feature X changes governance;

Then:
- “Feature X is GA” may be supported by official evidence;
- the Reddit comment appears under community questions;
- the comment cannot substantiate governance behavior;
- the creator may add an inference about governance only if it links to evidence-capable sources and is labeled inference.

### B2 — Creator post points to a technical claim
Given:
- LinkedIn reference says “gateway overhead is 0.66 ms”;
- linked benchmark/source is not yet captured;

Then:
- reference is retained as a presentation/research lead;
- numerical claim remains unsupported;
- workbench proposes finding/capturing the primary benchmark;
- drafting remains blocked if that number is required.

### B3 — Conflicting first-party sources
Given:
- older official documentation and newer release note describe different behavior;

Then:
- both sources are preserved;
- version/date is shown;
- claim is `disputed` until the newer applicable behavior is resolved;
- system must not concatenate both into a confident statement.

### B4 — Unresolved shortlink
Given a Reddit `/s/` or LinkedIn shortlink that cannot be resolved:
- store it;
- show resolution failure;
- do not extract claims from guessed content;
- do not count it toward evidence readiness.

### B5 — Analysis post requires point of view
Given all factual claims are supported but `mode=analysis` and no `creatorTake` exists:
- research evidence gate may pass;
- research-to-plan gate blocks with `blocked-perspective`;
- user is asked for the non-obvious conclusion/trade-off, not a generic “tone” prompt.

### B6 — Experience content
Given `mode=experience`:
- community/reference sources may provide questions/context;
- first-person claims remain blocked until explicit author-owned input is captured;
- no model may infer experience from professional profile metadata alone.

### B7 — Source failure recovery
If primary source fetch fails:
- previously captured source metadata remains visible;
- source is marked fetch/enrichment failed;
- facts depending on missing content remain unresolved;
- retrying may update resolution status but must not change source identity silently.

### B8 — Shared object continuity
When moving Research → Artifact Planning:
- same Content Brief ID persists;
- source IDs and claim IDs persist;
- selected/excluded claims are recorded;
- no plain-text copy/paste handoff is the source of truth.

### B9 — Long-form media repurposing preserves provenance
Given:
- a YouTube/video/transcript source;
- an extracted hook or factual statement selected for a carousel/post/thread;

Then:
- the extracted item retains its source ID and source segment/timestamp where available;
- the workbench can show source passage → extracted hook/claim side-by-side;
- a transformed hook that materially changes the source meaning is not silently accepted;
- if timestamp/segment resolution fails, the item is marked untraced and cannot count as evidence for a required factual claim;
- platform-specific wording may change, but the underlying supported meaning and provenance remain linked.

## Non-goals for Slice B

Do not implement yet:
- LinkedIn/Medium drafting;
- scheduling;
- publishing;
- analytics;
- visual rendering;
- autonomous posting;
- AI comment engagement.

## Verification required before Slice B can advance

1. domain tests for every B1–B9 scenario;
2. negative tests for evidence-class leakage;
3. durable save/reload of a workbench with sources + claims + perspective;
4. hosted API receipts;
5. browser UAT using at least one real official discovery, one community/reference input, and one long-form media/transcript input;
6. refresh/recovery test after source enrichment failure;
7. source-segment/timestamp traceability test for media-derived claims/hooks;
8. exact SHA/deployment receipt;
9. comparison against this contract and the Feedback Matrix;
10. tracker status updated only from the resulting evidence.
