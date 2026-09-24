# RE-228 — Typist → Local-first Text Art Studio

## Source
- Reddit: https://www.reddit.com/r/vibecoding/s/MaBpJFcVM9
- Upstream: https://github.com/winchxyz/typist
- Live app: https://winchxyz.github.io/typist/
- Upstream license: MIT

## Why this belongs in Faceless Content Creator
Typist is not a separate canonical product in our portfolio. It is a capability donor for a local-first text-art creation/export surface inside Faceless Content Creator.

The useful capability is distinct from the existing server-side video/render engine:
1. photo stays on-device;
2. browser converts it into Braille, ASCII, or Unicode blocks;
3. target-specific formatters resize/count output for Instagram, X, Telegram, Reddit, or file export;
4. the user previews the exact text grid at representative device metrics;
5. copy/share/download never requires a backend render job.

This should remain an isolated client-side module so adding the capability does not weaken the existing tenant/media authorization boundary or force uploaded user images through the hosted SaaS path.

## Verified upstream behavior
The public upstream documents and repository verify:
- plain ES modules, static hosting, no runtime framework/build dependency;
- browser-only image processing; photos are not uploaded;
- Braille, shape-aware ASCII, and Unicode block output;
- crop/zoom/rotate and tone controls;
- Atkinson, Floyd–Steinberg, ordered/Bayer, and threshold dithering;
- target-aware formatting for Instagram, X free/long, Telegram message/channel, Reddit, and file output;
- UTF-16 counting for Instagram/Telegram and a tested X-weighted counter;
- U+2800 blank Braille cells to survive proportional-font trimming;
- Windows-safe U+2840 blank mode because Windows Braille glyph widths can shear rows;
- true-size phone/device previews and wrap/fold warnings;
- PNG export for every target plus SVG, HTML, and TXT in file mode;
- undo/redo, drag/drop/paste intake, keyboard shortcuts;
- deterministic pure conversion stages after sampling;
- Node unit/fuzz tests plus Playwright E2E in Chromium/Firefox/WebKit.

## Upstream pipeline
```text
ImageBitmap/canvas + crop
  -> sample lightness/RGB grid
  -> tone normalization
  -> encode braille | ascii | blocks
  -> target formatter
  -> count / fit / warnings
  -> preview
  -> clipboard/share/export
```

### Canonical grid
```ts
type TextArtGrid = {
  mode: 'braille' | 'ascii' | 'blocks'
  cols: number
  rows: number
  codepoints: Uint32Array
  foreground?: Uint32Array
  background?: Uint32Array
  ink: number
}
```

## Clean-room implementation boundary
We may use the MIT source as a documented donor, but the Faceless Content Creator implementation should preserve its own architecture and tests.

Do not:
- make server upload mandatory for conversion;
- couple Text Art Studio to workspace billing/auth for basic local conversion;
- claim exact platform fit for untested device/app combinations;
- silently treat target character limits as permanent constants without versioning;
- claim platform posting succeeded when only clipboard/composer handoff occurred.

## Proposed owned architecture
```text
apps/web/text-art
  image intake
    -> crop state
    -> sampler
    -> tone pipeline
    -> encoder registry
    -> target formatter registry
    -> fit/count diagnostics
    -> device preview
    -> clipboard/share/export

packages/text-art-core
  grid.ts
  sample.ts
  tone.ts
  braille.ts
  ascii.ts
  blocks.ts
  count.ts
  targets.ts
  fit.ts
  export.ts

packages/text-art-test-fixtures
  deterministic RGBA fixtures
  platform-counter fixtures
  golden grid snapshots
```

All core transforms after image sampling should be pure and deterministic.

## Domain contracts

### Image source
```ts
type TextArtSource = {
  width: number
  height: number
  rgba: Uint8ClampedArray
}
```

### Crop
```ts
type CropTransform = {
  centerX: number
  centerY: number
  zoom: number
  rotationDeg: number
  aspect: number
}
```

### Tone
```ts
type ToneProfile = {
  autoLevels: boolean
  brightness: number
  contrast: number
  gamma: number
  detail: number
  edges: number
  invert: boolean
}
```

### Target
```ts
type TextArtTarget = {
  id: 'instagram-comment' | 'x-post' | 'x-long' |
      'telegram-message' | 'telegram-channel' |
      'reddit' | 'file'
  modeAllowlist: Array<'braille' | 'ascii' | 'blocks'>
  counter: 'utf16' | 'x-weighted' | 'none'
  limit?: number
  widthProfile: string
  formatterVersion: string
}
```

### Evidence-bearing output
```ts
type TextArtResult = {
  text: string
  html?: string
  count: number
  limit?: number
  fits: boolean
  cols: number
  rows: number
  wraps: boolean
  warnings: Array<{
    code: string
    severity: 'info' | 'warn' | 'error'
    message: string
  }>
  targetVersion: string
}
```

## Functional slices

### Phase A — deterministic local core
Ship only:
- image/RGBA sampler contract;
- Braille encoder;
- Atkinson + threshold dithering;
- basic tone controls;
- UTF-16 counter;
- Instagram, Telegram, and file targets;
- equal-width U+2800 row formatting;
- TXT export;
- pure unit tests + golden fixtures.

Acceptance:
- no network request is required to convert;
- no CR or trailing newline in target payloads;
- Braille output contains no ordinary spaces;
- deterministic fixtures match in repeated runs;
- oversized output fails with an explicit warning, never silent truncation.

### Phase B — target fidelity
Add:
- X weighted count;
- Reddit code-block formatting;
- Telegram ASCII fenced mode;
- auto-fit by target/device width;
- U+2840 Windows-safe mode;
- wrap/fold warnings;
- target rule versioning and regression fixtures.

Acceptance:
- analytic count equals formatted-payload count;
- X weighted counter is covered by boundary fixtures;
- target limits and widths are separately configurable;
- each warning has a deterministic test.

### Phase C — full studio UX
Add:
- drag/drop/paste/camera intake;
- crop/pinch/wheel/rotation;
- Braille / shape-aware ASCII / Unicode blocks;
- Floyd–Steinberg + ordered dithering;
- device preview profiles;
- undo/redo;
- copy/share/composer handoff;
- PNG/SVG/HTML/TXT export.

Acceptance:
- browser E2E in Chromium/Firefox/WebKit;
- phone-width responsive UAT;
- reduced-motion and keyboard flows;
- clipboard fallback when browser copy permission fails.

### Phase D — creator integration
Add:
- "Text Art" as an optional creative surface in Faceless Content Creator;
- convert workspace-owned media locally after explicit user selection;
- import TextArtResult into social-post drafts without claiming direct publish;
- optional reusable presets stored in workspace only when the user saves them;
- telemetry limited to explicit product events, never source image pixels.

Keep deterministic local conversion usable without account sign-in.

## Security and privacy
- decode files locally;
- cap image dimensions/file bytes before canvas allocation;
- reject malformed/unsupported image input cleanly;
- never interpolate user text into executable HTML;
- sanitize HTML export and use escaped/preformatted output;
- no background upload;
- revoke object URLs;
- avoid persistent storage of source photos by default;
- clear sensitive canvas/image buffers where practical;
- composer links/share targets must be treated as handoff, not publish confirmation.

## Performance targets
Repository targets, not claims until measured:
- initial 60×40 Braille conversion: <50 ms desktop Chromium;
- tone-only rerun: <15 ms;
- interaction preview remains responsive while dragging crop;
- export operations are cancelable and bounded by maximum dimensions.

## Test matrix
### Unit
- sampler geometry
- tone normalization
- braille bit mapping
- dithering determinism
- UTF-16 count
- X weighted count
- row padding / NFC / LF-only output
- target-specific formatter behavior
- fit calculation
- export MIME/content

### Fuzz/property
- arbitrary dimensions never produce out-of-bounds access;
- no invalid surrogate output;
- no forbidden CR;
- no target result reports `fits=true` when count exceeds limit;
- formatter round trips preserve rectangular grids.

### Browser
- upload/drop/paste
- crop + undo/redo
- target switches
- dark/invert
- copy permission success/fallback
- TXT/PNG/SVG/HTML downloads
- iPhone/Android/Windows preview modes
- responsive layout at 360/390/430 widths.

## Monetization
Keep basic local conversion free. Commercial value should come from creator workflow integration rather than gating the privacy-first utility:
- saved brand/text-art presets;
- bulk asset conversion;
- content-calendar/social-draft integration;
- reusable campaign templates;
- team preset libraries;
- higher-resolution/export automation;
- batch/API conversion for authorized workspace assets.

Do not introduce upload-only processing merely to meter usage.

## Evidence classification
### Repository-certifiable
- deterministic conversion;
- formatter/counter correctness;
- export behavior;
- local-only network boundary in automated browser tests;
- responsive UX;
- browser compatibility.

### External/device certification
- real Instagram/X/Telegram/Reddit paste behavior;
- exact mobile wrapping across OS/app/font-size combinations;
- composer/share-sheet behavior;
- platform character/count rule drift.

These must remain separate from repository CI.

## First implementation task
Implement Phase A only on this branch:
1. `packages/text-art-core`;
2. deterministic RGBA fixture;
3. Braille bit encoder;
4. Atkinson + threshold;
5. UTF-16 formatter/count;
6. Instagram/Telegram/file targets;
7. TXT export;
8. tests proving no-upload, LF-only, U+2800 padding, determinism, and over-budget warnings.

Do not claim X parity, real-device fit, multi-browser UX, direct publish, or production readiness until those later slices are implemented and evidenced.
