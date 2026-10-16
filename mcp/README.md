# Creator Visual Story MCP

This is the thin agent adapter for the owned Visual Story capability. It exposes bounded tools rather than giving an agent direct access to the Creator Console repository or render worker internals.

## Tools

- `visual_story_plan` — prompt → owned `VisualStorySpec` + QA receipt. Local and deterministic; no publication or render side effect.
- `visual_story_certify` — re-run visual QA after an agent or human edits a spec.
- `visual_story_render` — enqueue a certified spec on the owned render plane and return its durable job handle.
- `visual_story_render_status` — read durable render state and artifact URL.

The adapter deliberately separates planning from rendering. A model can inspect and modify the spec before invoking an action that consumes render capacity.

## Run

```bash
npm run mcp:visual-story
```

The server uses MCP over stdio. stdout is reserved for protocol messages; readiness/debug information goes to stderr.

## Render plane

By default render tools call `http://127.0.0.1:3000`. Override with:

```bash
VISUAL_RENDER_BASE_URL=https://render.example.com
```

For a hosted render plane that requires a workspace API key, configure `VISUAL_RENDER_API_KEY` in the MCP host environment. Do not put credentials into prompts or tool arguments.

## Ownership boundary

The MCP layer is an adapter, not a second implementation. Planning delegates to the same Creator Console planner/QA modules; rendering delegates to the existing durable render-job API. Agent Work OS therefore receives stable tool contracts while Creator Console remains the capability owner.
