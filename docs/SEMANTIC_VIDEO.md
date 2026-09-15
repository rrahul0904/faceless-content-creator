# Semantic Video Timeline

This module is a clean-room implementation of a useful programmable-video idea: visual events can be attached to the **meaningful words in a transcript** instead of being authored only at fixed second offsets.

It is intentionally implemented in the existing Faceless Content Creator architecture and does not copy Hypit source, syntax, package boundaries, or runtime code.

## Why this matters

A normal template might hard-code a product card to appear from `4.2s` to `6.8s`. That timing breaks as soon as narration is rewritten or delivered at a different pace.

The semantic timeline accepts word-level timestamps and a phrase anchor such as `"three AI tools"`. It resolves that phrase to the matching transcript words and emits exact render modifications:

```json
{
  "product-card.transitions.showAt": 4.18,
  "product-card.transitions.hideAt": 5.74
}
```

Those keys plug directly into the existing template render API. Nested transition modifications preserve unrelated transition properties.

## Compile API

`POST /api/v1/semantic-timeline/compile`

Example request:

```json
{
  "fps": 30,
  "words": [
    { "text": "Here", "start": 0.00, "end": 0.24, "speaker": "host" },
    { "text": "are", "start": 0.25, "end": 0.40, "speaker": "host" },
    { "text": "three", "start": 0.41, "end": 0.72, "speaker": "host" },
    { "text": "AI", "start": 0.73, "end": 0.93, "speaker": "host" },
    { "text": "tools", "start": 0.94, "end": 1.28, "speaker": "host" }
  ],
  "cues": [
    {
      "id": "show-tools-card",
      "target": "product-card",
      "phrase": "three AI tools",
      "speaker": "host",
      "padBefore": 0.1,
      "padAfter": 0.2
    }
  ]
}
```

Example result shape:

```json
{
  "ok": true,
  "data": {
    "fps": 30,
    "duration": 1.48,
    "events": [
      {
        "id": "show-tools-card",
        "target": "product-card",
        "phrase": "three AI tools",
        "occurrence": 1,
        "speaker": "host",
        "wordStartIndex": 2,
        "wordEndIndex": 4,
        "start": 0.31,
        "end": 1.48,
        "startFrame": 9,
        "endFrameExclusive": 45
      }
    ],
    "modifications": {
      "product-card.transitions.showAt": 0.31,
      "product-card.transitions.hideAt": 1.48
    }
  }
}
```

For elements on later pages, use the existing modification prefix in `target`, for example `page2@product-card`.

## Matching rules

- phrase matching is contiguous and case-insensitive;
- ordinary punctuation is ignored when comparing transcript tokens;
- `occurrence` is one-based, so repeated phrases can be targeted deterministically;
- `speaker` optionally constrains every matched word to one speaker;
- `padBefore`, `padAfter`, and `minDuration` adjust the resolved window without changing the semantic anchor;
- duplicate cue IDs and duplicate targets are rejected rather than silently overwriting another cue;
- a missing semantic anchor returns HTTP `422` with `ANCHOR_NOT_FOUND` and the cue ID.

## Render integration

The compile response's `modifications` object can be passed unchanged to the existing Studio render endpoint:

```json
{
  "templateId": "template-id",
  "modifications": {
    "product-card.transitions.showAt": 0.31,
    "product-card.transitions.hideAt": 1.48
  },
  "response": {
    "format": "mp4",
    "mode": "async"
  }
}
```

This first slice deliberately stops at the transcript-to-render-plan boundary. The next layer should produce the word timing automatically from uploaded/reference media, then let reference analysis author these cue relationships instead of asking users to hand-write them.
