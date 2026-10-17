import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const require = createRequire(import.meta.url);
const { planVisualStory } = require('../creator-console/lib/visual-story');
const { certifyVisualStory } = require('../creator-console/lib/visual-story-qa');
const { registryVersion, verifiedAt, searchTechnicalIcons } = require('../creator-console/lib/technical-icons');

const formatSchema = z.enum(['process', 'roadmap', 'comparison', 'stats', 'architecture', 'listicle']);
const motionSchema = z.enum(['flow', 'build', 'pulse']);
const sizeSchema = z.enum(['portrait', 'square', 'landscape']);
const outputSchema = z.enum(['gif', 'mp4']);
const storyIdSchema = z.string().min(6).max(128).regex(/^[a-zA-Z0-9_-]+$/);

const brandSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z.string().max(80).optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).optional();

function renderBaseUrl() {
  return String(process.env.VISUAL_RENDER_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

function renderHeaders() {
  const apiKey = String(process.env.VISUAL_RENDER_API_KEY || '').trim();
  return {
    'content-type': 'application/json',
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

function result(value, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: 'INVALID_JSON_RESPONSE', status: response.status };
  }
  return { response, body };
}

function createServer() {
  const server = new McpServer({
    name: 'creator-visual-story',
    version: '1.3.0',
  });

  server.registerTool(
    'visual_story_plan',
    {
      title: 'Plan Visual Story',
      description: 'Turn a source prompt into the owned VisualStorySpec contract and return its deterministic visual-QA receipt. No publishing occurs.',
      inputSchema: z.object({
        prompt: z.string().min(1).max(4000),
        format: formatSchema.optional(),
        motion: motionSchema.default('flow'),
        size: sizeSchema.default('portrait'),
        brand: brandSchema,
      }),
    },
    async ({ prompt, format, motion, size, brand }) => {
      try {
        const spec = planVisualStory({ prompt, ...(format ? { format } : {}), motion, size, ...(brand ? { brand } : {}) });
        const qa = certifyVisualStory(spec);
        return result({ spec, qa });
      } catch (error) {
        return result({ error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    'visual_story_certify',
    {
      title: 'Certify Visual Story',
      description: 'Re-run the owned visual QA contract after an agent or human edits a VisualStorySpec.',
      inputSchema: z.object({ spec: z.record(z.string(), z.unknown()) }),
    },
    async ({ spec }) => {
      try {
        return result({ qa: certifyVisualStory(spec) });
      } catch (error) {
        return result({ error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    'visual_story_icon_search',
    {
      title: 'Search Governed Technical Icons',
      description: 'Search the local governed technical-icon registry. Results include official source, usage class and whether an official asset is installed or the renderer will use an explicit neutral fallback. This tool makes no network request.',
      inputSchema: z.object({
        query: z.string().max(160).default(''),
        provider: z.string().max(40).default(''),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    },
    async ({ query, provider, limit }) => result({
      registry: { version: registryVersion, verifiedAt },
      data: searchTechnicalIcons(query, provider).slice(0, limit),
    }),
  );

  server.registerTool(
    'visual_story_refine',
    {
      title: 'Refine Saved Visual Story',
      description: 'Apply a bounded conversational refinement to an existing persisted visual story. The render plane appends an immutable version, retains source provenance and regenerates QA. Registered technical icons can be assigned with instructions such as icon item 1: aws:s3. No publishing occurs.',
      inputSchema: z.object({
        storyId: storyIdSchema,
        instruction: z.string().min(1).max(1000),
      }),
    },
    async ({ storyId, instruction }) => {
      try {
        const { response, body } = await fetchJson(`${renderBaseUrl()}/api/v1/visual-stories/${encodeURIComponent(storyId)}/refine`, {
          method: 'POST',
          headers: renderHeaders(),
          body: JSON.stringify({ instruction }),
        });
        return result(body, !response.ok);
      } catch (error) {
        return result({ error: 'RENDER_PLANE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    'visual_story_carousel',
    {
      title: 'Compile Visual Story Carousel',
      description: 'Compile an ad-hoc VisualStorySpec or persisted visual story into deterministic 1080x1350 carousel artboards. Every slide is independently QA-certified and persisted stories retain exact story/version provenance. No publishing occurs.',
      inputSchema: z.object({
        spec: z.record(z.string(), z.unknown()).optional(),
        storyId: storyIdSchema.optional(),
        itemsPerSlide: z.number().int().min(1).max(4).default(2),
      }).refine(value => Boolean(value.spec) !== Boolean(value.storyId), { message: 'Provide exactly one of spec or storyId.' }),
    },
    async ({ spec, storyId, itemsPerSlide }) => {
      try {
        const url = storyId
          ? `${renderBaseUrl()}/api/v1/visual-stories/${encodeURIComponent(storyId)}/carousel`
          : `${renderBaseUrl()}/api/v1/visual-stories/carousel`;
        const payload = storyId ? { itemsPerSlide } : { spec, itemsPerSlide };
        const { response, body } = await fetchJson(url, {
          method: 'POST',
          headers: renderHeaders(),
          body: JSON.stringify(payload),
        });
        return result(body, !response.ok);
      } catch (error) {
        return result({ error: 'RENDER_PLANE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    'visual_story_render',
    {
      title: 'Queue Durable Visual Story Render',
      description: 'Render either an ad-hoc VisualStorySpec or a persisted story. Persisted-story rendering preserves visualStoryId/version provenance. The render plane re-certifies before queueing; this tool does not publish.',
      inputSchema: z.object({
        spec: z.record(z.string(), z.unknown()).optional(),
        storyId: storyIdSchema.optional(),
        output: outputSchema.default('gif'),
      }).refine(value => Boolean(value.spec) !== Boolean(value.storyId), { message: 'Provide exactly one of spec or storyId.' }),
    },
    async ({ spec, storyId, output }) => {
      try {
        const url = storyId
          ? `${renderBaseUrl()}/api/v1/visual-stories/${encodeURIComponent(storyId)}/render`
          : `${renderBaseUrl()}/api/v1/visual-stories/render`;
        const payload = storyId ? { output } : { spec, output };
        const { response, body } = await fetchJson(url, {
          method: 'POST',
          headers: renderHeaders(),
          body: JSON.stringify(payload),
        });
        return result(body, !response.ok);
      } catch (error) {
        return result({ error: 'RENDER_PLANE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    'visual_story_render_status',
    {
      title: 'Get Visual Story Render Status',
      description: 'Read the durable state of a visual-story render job and return its artifact URL plus persisted story/version provenance when complete.',
      inputSchema: z.object({ jobId: z.string().min(6).max(128).regex(/^[a-zA-Z0-9_-]+$/) }),
    },
    async ({ jobId }) => {
      try {
        const { response, body } = await fetchJson(`${renderBaseUrl()}/api/v1/render-jobs/${encodeURIComponent(jobId)}`, {
          headers: renderHeaders(),
        });
        return result(body, !response.ok);
      } catch (error) {
        return result({ error: 'RENDER_PLANE_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  return server;
}

void serveStdio(createServer);
console.error('Creator Visual Story MCP server listening on stdio');
