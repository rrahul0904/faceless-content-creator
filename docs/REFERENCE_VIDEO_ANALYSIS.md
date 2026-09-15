# Reference Video Analysis

This slice extends the semantic-video foundation with local reference-media analysis. It stays inside the existing Faceless Content Creator stack and uses the FFmpeg/ffprobe tooling already required by the renderer.

## What it does

`POST /api/v1/reference-video/analyze` analyzes an uploaded MP4, WebM, or MOV by filename and returns:

- duration, dimensions, frame rate, byte size, container format, and audio presence;
- hard-cut timestamps detected with FFmpeg's scene-change score;
- normalized scene windows;
- editing rhythm statistics such as average/median scene length and cuts per minute;
- optional semantic transcript events attached to the detected scene that contains each event.

The analyzer never accepts an arbitrary filesystem path. It resolves only simple filenames inside `data/uploads`, uses the same upload area as `/api/media`, and rejects unsupported extensions before invoking FFmpeg.

## Example

Upload a reference video through `POST /api/media`, then send its returned `filename`:

```json
{
  "filename": "f0372e93-3d46-48bd-95f8-6b9326934330.mp4",
  "sceneThreshold": 0.2,
  "semantic": {
    "words": [
      { "text": "Now", "start": 1.05, "end": 1.20, "speaker": "host" },
      { "text": "show", "start": 1.21, "end": 1.40, "speaker": "host" },
      { "text": "the", "start": 1.41, "end": 1.52, "speaker": "host" },
      { "text": "dashboard", "start": 1.53, "end": 1.92, "speaker": "host" }
    ],
    "cues": [
      {
        "id": "dashboard-reveal",
        "target": "dashboard-card",
        "phrase": "show the dashboard",
        "speaker": "host",
        "padBefore": 0.05,
        "padAfter": 0.15
      }
    ]
  }
}
```

The response preserves the semantic compiler output while enriching each event with `sceneIndex`, `sceneStart`, and `sceneEnd`. That gives the next reverse-engineering layer enough information to learn relationships such as "this visual appears on the first shot after the presenter says X" rather than storing only absolute seconds.

## Scene threshold

`sceneThreshold` is FFmpeg's normalized scene-change score cutoff. Lower values produce more cuts; higher values require stronger visual changes. The accepted range is `0.01` to `1.0`, with `0.3` as the default.

For clean hard-cut references, values around `0.1` to `0.3` are a useful starting point. Highly dynamic footage may need a higher value to avoid treating motion as an edit.

## Current boundary

This phase performs deterministic local visual analysis and can combine it with word timings supplied by a transcription/alignment layer. Automatic speech-to-word transcription itself is intentionally kept behind the next provider boundary rather than introducing a hidden cloud dependency into the base image.

The next capability should add a transcription adapter and persist a reusable reference blueprint containing:

1. scene structure and pacing;
2. word-level transcript timing;
3. semantic visual anchors;
4. template/render modifications that recreate the observed relationships with new content.
