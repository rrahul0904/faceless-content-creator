# RE-359 — EngramLabz math-explainer research and clean-room implementation

Research snapshot: 2026-10-01

## Sources
- Supplied Reddit launch: https://www.reddit.com/r/SideProject/comments/1wuzoet/i_built_an_app_that_turns_maths_questions_into/
- Product: https://www.engramlabz.com/
- Open comparator: https://github.com/HarleyCoops/Math-To-Manim
- Manim Community: https://www.manim.community/

## Observed product contract
EngramLabz presents a topic/audience-to-finished-video workflow. Public materials describe a staged pipeline spanning script planning, synthetic narration, code-driven vector animation, automated checks, final rendering and packaging into video/caption/chapter artifacts. The Reddit launch names Manim as the animation technology and explicitly says the showcased clip was manually tightened, so it is treated as a best-case artifact rather than proof of average generation quality.

The current product FAQ says completed films are not yet editable; changing one requires ordering another film. That gap is intentionally not reproduced in RE-359.

## Feedback signal
At the research snapshot, the supplied thread exposed one substantive third-party comment: use Monty Hall as a test because a convincing animation must explain the probability mechanism rather than merely state the familiar 2/3 result.

That becomes a first-class acceptance property:
1. critical result claims carry verification receipts;
2. a result is supported by derivation/demonstration/contrast before conclusion;
3. misconception-sensitive claims can require a contrast scene;
4. assertion-only drafts fail compilation.

No deleted or inaccessible comments are reconstructed.

## Canonical mapping
RE-359 is consolidated into `rrahul0904/faceless-content-creator`.

That repository already owns the cross-cutting media platform: editable template documents, durable render jobs/cancellation, FFmpeg composition, semantic word timing, TTS/subtitles, workspace media, quotas/credits and a GPU-service boundary. Creating a parallel media SaaS would duplicate mature infrastructure.

ML Canvas Academy can later consume this capability for narrated lessons, but it is not the rendering system of record.

## Clean-room architecture
```text
Question/topic + audience
        ↓
Learning brief / prerequisites / misconceptions
        ↓
MathClaim[] + verification receipts
        ↓
Chapters + editable SceneSpec[]
        ↓
Deterministic pedagogical compiler
  ├─ claim coverage
  ├─ critical verification
  ├─ explain-not-assert ordering
  ├─ misconception contrast
  ├─ duration budget
  └─ editability / dependency invalidation
        ↓
Renderer adapter (planned first backend: Manim)
        ↓
Static/sandbox checks + bounded scene repair
        ↓
Existing TTS + semantic timeline + subtitles
        ↓
Existing durable render worker + FFmpeg package
        ↓
MP4 + SRT + chapter marks + run/evidence receipts
```

## Phase A implemented in this branch
- versioned Zod contracts for claims, chapters and scenes;
- deterministic compiler with evidence-derived quality gates;
- workspace-scoped `POST /api/v1/math-explainer/compile`;
- scene-level editability/invalidation contract;
- Monty Hall explanatory smoke fixture;
- assertion-only negative fixture returning `EXPLAIN_NOT_ASSERT`.

Phase A deliberately does **not** run a model, execute arbitrary Python, render Manim, synthesize narration, claim formal proof, or claim target parity/production readiness.

## Next slices
### Phase B — safe renderer vertical
Introduce a narrow Manim worker contract with generated-source static checks, no network, bounded filesystem/output roots, resource/time limits, one synthetic scene render, FFprobe/decode receipts and no claim that local process isolation equals a hardened sandbox.

### Phase C — model-backed authoring
Add provider-neutral stages for learning brief, prerequisite map, mathematical dossier, script, storyboard and SceneSpec. Persist prompts/outputs/receipts, route repairs to the earliest invalid stage, and connect narration to existing semantic word timing. Model output never bypasses deterministic gates.

### Phase D — editor and partial rerender
Expose chapter/claim/scene artifacts in the Studio, support copy/narration/visual-intent edits, invalidate dependent receipts only, and rerender only changed scenes before repackaging.

### Phase E — hosted evidence
Only after exact-head CI and real render evidence: distributed renderer queue, object storage/CDN, customer billing surfaces, broader concept benchmark and browser/accessibility certification.

## Comparator lessons
Math-To-Manim's public MIT repository is useful evidence for typed stage artifacts, evidence checks, storyboard/scene separation, bounded repairs and rendered-frame review. It also explicitly warns that local rendering/static checks are not themselves an arbitrary-Python security boundary. RE-359 follows the same truthful distinction without copying private EngramLabz implementation details.

## Acceptance benchmarks to add
- Monty Hall: intuition conflict; explanation must preserve initial probability and show host constraint.
- Birthday paradox: cumulative-complement reasoning rather than raw conclusion.
- Product rule: symbolic transformation + visual dependency.
- Determinant: geometric and algebraic interpretations agree.
- One intentionally misleading draft per benchmark must fail a deterministic gate.

## Boundaries
No EngramLabz private source, prompts, branding, themes, media or proprietary timing data are used. Public claims remain source claims until independently reproduced. No deployment or production-readiness claim is made by this Phase A slice.
