# RE-375 runtime certification state

This file records what the branch can prove at the current revision. It must not be used to imply hosted or Trupeer parity.

## Implemented golden path

```text
first-party browser rehearsal capture
  -> workspace-bound WorkflowCapture
  -> immutable WorkflowRevision
  -> deterministic StepGraph
  -> provenance-rich GuideDocument / Markdown SOP
  -> provenance-rich VideoPlan
  -> renderer-owned TemplateDocument
  -> durable render job
  -> local TTS + FFmpeg multi-page composition
  -> MP4 asset
```

The workflow studio intentionally captures action labels/selectors rather than typed field values. Arbitrary third-party-site capture via a browser extension is not part of the current certified slice.

## Exact-head acceptance gates

The CI workflow must prove all of the following before this slice is called locally working:

1. production dependency audit has no high-severity findings;
2. lint and TypeScript pass;
3. deterministic compiler smoke passes, including revision diff/invalidation, provenance, workspace isolation, review blocking and cost preflight;
4. production Next.js build passes;
5. the base renderer produces a real MP4;
6. the Docker image builds and boots;
7. existing authenticated API, quota and hosted-auth smokes remain green;
8. an isolated Docker app accepts a three-step workflow through `/api/v1/workflows/render`;
9. that request persists a renderer template tied to the exact source revision;
10. the resulting render job reaches `succeeded` and its MP4 is byte-range readable;
11. a sensitive workflow is rejected with `409` before export/render proceeds.

## Not yet certified by this slice

- arbitrary Chrome/Edge page capture or screen recording
- screenshot/OCR extraction from external applications
- live STT or model-backed script polishing
- multilingual localization variants and glossary QA
- revision-aware hosted knowledge-base search
- external LMS/help-center integrations
- hosted Railway production deployment and persistent media-volume recovery
- production browser/device UAT

These remain subsequent shipping gates and must not be marked complete from fixture/local-runtime evidence alone.
