# BYSO reverse-engineering dossier

Status: evidence pass 1 complete; implementation branch started
Parent research: https://github.com/rrahul0904/agent-work-os/issues/97
Implementation issue: https://github.com/rrahul0904/faceless-content-creator/issues/26
Source product: https://byso.online/
Intake source: https://www.reddit.com/r/IMadeThis/s/Z6BN8JTqww

## Clean-room boundary

This document records behavior visible on public product pages and maps that behavior to an independent implementation in this repository. Do not copy BYSO branding, source code, private APIs, proprietary prompts, generated assets, or non-public implementation details. Treat implementation mechanics as hypotheses unless public evidence supports them.

## Product thesis

BYSO is best understood as two connected surfaces:

1. a bundled YouTube publish-preparation workflow; and
2. small free or low-cost creator utilities that funnel users into that workflow.

The reusable idea is not a collection of unrelated AI pages. It is a shared media/YouTube ingestion layer feeding deterministic normalizers and bounded AI processors, with artifacts/history, quotas/credits, and a publish-preparation UI around them.

## Publicly observed bundled workflow

The public dashboard exposes the following progress stages:

```text
source
  -> subtitles / transcription
  -> SEO
  -> chapters
  -> thumbnails
  -> package
```

Observed source inputs:

- YouTube URL
- video file
- audio file
- SRT / VTT subtitle file
- output language
- generation type
- optional thumbnail text
- up to five reference photos

Observed outputs and account behavior:

- optimized title
- description
- tags
- chapters
- up to three thumbnails
- generation progress
- history for the last 100 generations
- thumbnail retention for three months
- Google and email/password sign-in surfaces
- credit balance and top-up UI
- card checkout through Stripe and crypto checkout through CryptoBot

Public pricing observed on 2026-10-10:

- free signup: 10 credits
- full generation: $0.50
- SEO only: $0.10
- no monthly subscription advertised

The dashboard says a bundled generation usually takes 1-3 minutes and may take up to 7 minutes at peak load. Treat those numbers as product behavior, not as an implementation target until our own latency/cost measurements exist.

## Public tools inventory

Observed `/tools` surface:

| Tool | Observed behavior | Auth / metering notes |
| --- | --- | --- |
| Thumbnail Preview | feed/sidebar preview, desktop/mobile contexts, squint and grayscale checks | free, no sign-up; uploaded preview image described as browser-local |
| Comment Analyzer | audience themes, mood, questions, ideas, praise, criticism, mentioned moments, liked comments | free <=1,000 comments with daily limit; larger runs metered |
| AI Thumbnail Generator | prompt + optional reference photos; 16:9, 9:16, 1:1; style presets | sign-in; credit-metered |
| Thumbnail Reformatter | redraw composition between 16:9, 9:16, 1:1 rather than simple crop | sign-in; credit-metered |
| Thumbnail Downloader | download public YouTube thumbnail | free |
| Timestamp Generator | generate ready-to-paste chapters from URL or uploaded media; optional steering prompt | sign-in; credit-metered |
| Video SEO Checker | checks title, description, chapters, tags, hashtags, thumbnail and captions against documented rules | free |
| Subtitle Translator | review/fix source transcript, then context-aware translation with timings preserved | sign-in; length-metered |
| Tag Extractor | reads tags for a public video and exposes 500-character budget | free |
| Transcript Downloader | plain/timestamped/SRT/VTT transcript, summary and transcript-grounded Q&A | base transcript free; Q&A account/credit behavior observed |

## Confirmed implementation clues from public copy

### Comment analyzer

BYSO states that it:

- reads comments and replies through the official YouTube Data API;
- paginates until the comment section ends;
- cannot access held-for-review, deleted, or disabled comments;
- removes empty, emoji-only, `first!`, and exact-duplicate content before analysis;
- sends small sets to a model in one piece;
- uses a map/reduce-style condensation flow for larger sets;
- limits very large analyses to the 100,000 most relevant comments;
- distinguishes verbatim comment quotes from estimated percentages.

Independent implementation implication: keep acquisition/filtering deterministic and preserve source IDs/provenance before model summarization.

### Transcript downloader

BYSO states that its transcript utility:

- reads caption tracks already published by YouTube rather than transcribing them;
- returns nothing when no caption track exists;
- distinguishes creator-provided/corrected tracks from automatic captions;
- exports plain text, timestamped text, SRT and VTT;
- trims overlapping automatic-caption cue end times to prevent stacked cues while preserving starts;
- grounds summary and Q&A in the transcript and reports when a question is not covered.

Independent implementation implication: transcript acquisition, normalization and provenance should be reusable deterministic infrastructure. LLM summary/Q&A should be downstream processors, not part of ingestion.

### Subtitle translator

Observed workflow:

```text
acquire subtitles
  -> review original transcript synchronized with video
  -> user can correct source text
  -> translate with full-context model
  -> copy / download SRT
```

This human correction gate is worth preserving because it prevents ASR errors in names/jargon from silently propagating into every target language.

### Timestamp generator

Observed behavior:

- YouTube URL or uploaded video/audio input
- optional prompt to steer chapter style
- six output languages
- regeneration/copy/history surface

### Thumbnail workspace

Observed generator behavior:

- prompt-driven generation
- up to five reference photos
- 16:9, 9:16 and 1:1 formats
- multiple named style presets
- subsequent reformat/redraw action

Observed preview behavior:

- desktop, mobile and 168px sidebar contexts
- title truncation context
- competitor-topic context
- squint/blur test
- grayscale test
- duration-badge placement awareness

## Architecture we should build

Reuse this repository's existing workspace ownership, durable-job, quota/credit, media, history, review and publisher boundaries.

```text
YouTube URL / uploaded media / subtitle file
                |
                v
        SourceNormalizer
                |
      +---------+----------+
      |                    |
      v                    v
CaptionEvidence       CommentEvidence
      |                    |
      +---------+----------+
                |
                v
        VideoIntelligenceJob
                |
      +---------+------------------------------+
      |         |          |          |         |
      v         v          v          v         v
 transcript   comments    SEO      chapters   thumbnail
 processors   insights   package   generator   workspace
      |         |          |          |         |
      +---------+----------+----------+---------+
                |
                v
       PublishReadinessPackage
                |
                v
     existing review / schedule / publish
```

### Core contracts

`VideoSource`
- kind
- original input
- canonical video ID / canonical URL where applicable
- workspace ID
- source ownership / public-source provenance

`CaptionEvidence`
- track language
- source type: creator / automatic / imported / none
- timestamped cues
- normalization receipt

`CommentEvidence`
- video ID
- page/reply acquisition metadata
- comment count acquired
- filtering receipt
- truncation/cap metadata

`VideoIntelligenceJob`
- state
- workspace ID
- source
- requested processors
- evidence references
- processor/model versions
- artifacts
- safe error code
- timestamps

`PublishReadinessPackage`
- proposed title(s)
- description
- tags
- chapters
- thumbnail candidates / references
- localization artifacts
- evidence/provenance links
- confidence/warning fields
- approval state

## Build order

### Phase 1 — deterministic foundation

1. YouTube URL / video-ID canonicalization.
2. Durable workspace-scoped `VideoIntelligenceJob`.
3. Caption acquisition boundary and normalized transcript representation.
4. Transcript exports: plain, timestamped, SRT, VTT.
5. Typed unavailable/no-caption states.
6. Comment acquisition interface and bounded filtering contract.
7. Tests for malformed/deceptive URLs, caption overlaps, no-caption behavior, cancellation, workspace isolation and quota rejection.

### Phase 2 — grounded intelligence

1. transcript summary with evidence timestamps;
2. transcript-grounded Q&A with explicit `not_covered` result;
3. comment theme/question/praise/criticism analysis;
4. comment -> next-video idea generation with evidence links;
5. deterministic SEO rules before generative advice;
6. chapters from normalized transcript.

### Phase 3 — publish-prep bundle

1. title candidates;
2. description;
3. tags with character-budget accounting;
4. thumbnail preview workspace;
5. thumbnail generation/reformatting as optional AI processors;
6. subtitle/localization pipeline;
7. one `Optimize for YouTube` orchestration producing a `PublishReadinessPackage`.

### Phase 4 — strategic enhancements beyond BYSO

- channel-level memory and brand/voice constraints;
- multi-video and competitor content-gap analysis;
- comment clusters linked directly to script/topic generation;
- performance feedback loop using our analytics surface;
- provenance/confidence for every recommendation;
- pre-publish policy checks;
- explicit human approval before any external publish action;
- reuse the same intelligence package for long-form, Shorts and derivative social assets.

## Clone / improve / skip decision

### Clone the product primitive

- unified source ingestion
- transcript provenance and export
- chapters
- grounded comment intelligence
- thumbnail preview contexts
- bundled publish-ready output
- pay-per-use-compatible metering semantics

### Improve substantially

- consolidate all processors into one durable job/evidence model
- make every AI recommendation traceable to transcript/comment evidence
- feed insights back into this repo's script/render/template pipeline
- channel memory and learned winning-pattern retrieval
- actual performance analytics feedback after publishing
- deterministic rule checks before LLM recommendations

### Do not prioritize initially

- crypto checkout parity
- copying the exact public tool-site information architecture
- cloning dozens of thumbnail style names
- superficial SEO scoring that cannot explain its evidence

## Unknowns / hypotheses table

| Question | Current state | How to verify |
| --- | --- | --- |
| Exact BYSO backend framework | unknown | public headers/assets only; not required for parity |
| Exact model/provider for SEO text | unknown | do not infer; benchmark our own providers |
| Exact image model/provider | unknown | do not infer; evaluate against our requirements |
| Exact caption acquisition endpoint/mechanism | partially observed behavior only | build provider abstraction; use legal/public interfaces |
| Exact storage schema | unknown | irrelevant; design around our workspace model |
| Detailed failure/retry behavior | unknown | public black-box tests where allowed; define stronger own contract |
| Connected-channel OAuth requirement | main generation appears URL/file-driven; publishing connection not established | keep existing publisher OAuth boundary separate |

## Verification gates

- URL parser negative tests, including deceptive hostnames
- caption fixture tests with creator and automatic tracks
- SRT/VTT overlap normalization tests
- typed no-caption / comments-disabled behavior
- large comment-set boundedness
- model output schema validation
- replay receipt records evidence + processor/model versions
- workspace isolation
- quota accounting before expensive provider work
- no tokens/secrets in stored artifacts or logs
- UI regression for preview and publish-readiness workflow
- exact-SHA CI evidence before merge

## Sources consulted in evidence pass 1

- https://byso.online/
- https://byso.online/tools
- https://byso.online/tools/youtube-comment-analyzer
- https://byso.online/tools/youtube-transcript
- https://byso.online/tools/youtube-subtitle-translator
- https://byso.online/tools/youtube-timestamp-generator
- https://byso.online/tools/youtube-thumbnail-preview
- https://byso.online/tools/youtube-badge-generator
- https://byso.online/blog/do-youtube-tags-matter

Evidence captured 2026-10-10. Public behavior can change; re-check before claiming parity.