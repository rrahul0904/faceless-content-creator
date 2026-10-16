# Creator Visual Story MCP

This is the thin agent adapter for the owned Visual Story capability. It exposes bounded tools rather than giving an agent direct access to the Creator Console repository or render worker internals.

## Tools

- `visual_story_plan` — prompt → owned `VisualStorySpec` + QA receipt. Local and deterministic; no publication or render side effect.
- `visual_story_certify` — re-run visual QA after an agent or human edits a spec.
- `visual_story_refine` — apply a bounded natural-language refinement to a **persisted** story. The render plane appends an immutable version, preserves the original source prompt, records the instruction in provenance and regenerates QA.
- `visual_story_render` — render exactly one of: an ad-hoc spec or a persisted `storyId`. Persisted rendering carries `visualStoryId + version` into the render receipt.
- `visual_story_render_status` — read durable render state, artifact URL and persisted story/version provenance.

The adapter deliberately separates planning, refinement and rendering. A model can inspect a spec first, refine a saved project without overwriting history, and only then invoke an action that consumes render capacity.

## Bounded refinement language

The current deterministic refinement compiler intentionally supports a constrained set of safe transformations rather than pretending arbitrary free-form editing is reliable. Supported instructions include:

- title/headline changes
- format changes: process, roadmap, comparison, stats, architecture, listicle
- motion changes: flow, build, pulse
- canvas changes: portrait, square, landscape
- primary/accent/background/text hex colors
- concise/tighten/reduce-copy requests
- remove details / labels-only
- remove a numbered item
- add an item using `add item: Label | Detail | Value`

Unsupported instructions fail with `REFINEMENT_NOT_UNDERSTOOD`; the server does not silently invent a change.

## Run

```bash
npm run mcp:visual-story
```

The server uses MCP over stdio. stdout is reserved for protocol messages; readiness/debug information goes to stderr.

## Render plane

By default render/refine tools call `http://127.0.0.1:3000`. Override with:

```bash
VISUAL_RENDER_BASE_URL=https://render.example.com
```

For a hosted render plane that requires a workspace API key, configure `VISUAL_RENDER_API_KEY` in the MCP host environment. Do not put credentials into prompts or tool arguments.

## Ownership boundary

The MCP layer is an adapter, not a second implementation. Planning delegates to the Creator Console planner/QA modules. Versioned refinement and rendering delegate to the existing durable visual-story APIs. Agent Work OS therefore receives stable tool contracts while Creator Console remains the capability owner and the render plane remains the authority for persisted versions, QA and artifact provenance.
