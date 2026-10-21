import { createHash } from 'node:crypto';

/**
 * Clean-room, offline creative preproduction. Never calls a model, vendor,
 * network endpoint, filesystem, scheduler or publisher.
 * The API route must establish workspace ownership of product.assetId first.
 */
export type CreativeFormat = 'ugc' | 'product-ad' | 'cartoon-ad';
export type Channel = 'instagram' | 'tiktok' | 'youtube' | 'linkedin';

export type CreativePreviewInput = {
  product: {
    name: string;
    assetId: string;
    visualAnchors: string[];
    claims: Array<{ text: string; sourceUrl: string }>;
  };
  brief: {
    format: CreativeFormat;
    audience: string;
    objective: 'awareness' | 'consideration' | 'conversion';
    channel: Channel;
    durationSeconds: 15 | 30 | 45 | 60;
  };
};

export class CreativePreviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CreativePreviewError';
  }
}

function reject(code: string, message: string): never {
  throw new CreativePreviewError(code, message);
}

function text(value: unknown, field: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max ||
      /[\r\n\u0000-\u001F]/.test(value)) {
    return reject('INVALID_TEXT', field + ' must be nonempty single-line text of at most ' + max + ' characters');
  }
  return value.trim();
}

function evidenceUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000) return reject('INVALID_EVIDENCE', 'A source URL is required');
  let url: URL;
  try { url = new URL(value); } catch { return reject('INVALID_EVIDENCE', 'Invalid source URL'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !hostname.includes('.') || hostname === 'localhost' ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[')) {
    return reject('INVALID_EVIDENCE', 'Source must be a public HTTPS URL without credentials, ports or IP literals');
  }
  return url.toString();
}

export function previewCreativeProduction(workspaceId: string, input: CreativePreviewInput) {
  text(workspaceId, 'workspaceId', 128);
  if (!input || typeof input !== 'object' || !input.product || !input.brief) {
    return reject('INVALID_INPUT', 'Product and brief are required');
  }
  const name = text(input.product.name, 'product.name', 120);
  const assetId = text(input.product.assetId, 'product.assetId', 128);
  if (!/^[A-Za-z0-9_-]+$/.test(assetId)) return reject('INVALID_ASSET', 'Expected an owned brand asset ID');
  if (!Array.isArray(input.product.visualAnchors) || input.product.visualAnchors.length < 1 ||
      input.product.visualAnchors.length > 5) {
    return reject('INVALID_ANCHORS', 'Provide 1 to 5 user-observed visual anchors');
  }
  const anchors = input.product.visualAnchors.map((v, i) => text(v, 'visualAnchors[' + i + ']', 120));
  if (new Set(anchors.map(v => v.toLowerCase())).size !== anchors.length) {
    return reject('INVALID_ANCHORS', 'Visual anchors must be distinct');
  }
  if (!Array.isArray(input.product.claims) || input.product.claims.length < 1 ||
      input.product.claims.length > 8) {
    return reject('UNSUPPORTED_CLAIMS', 'Provide 1 to 8 claims with source URLs; never invent product claims');
  }
  const claims = input.product.claims.map((claim, i) => {
    if (!claim || typeof claim !== 'object') return reject('UNSUPPORTED_CLAIMS', 'Invalid claim');
    return { text: text(claim.text, 'claims[' + i + '].text', 240), sourceUrl: evidenceUrl(claim.sourceUrl) };
  });
  if (new Set(claims.map(c => c.text.toLowerCase())).size !== claims.length) {
    return reject('UNSUPPORTED_CLAIMS', 'Claims must be distinct');
  }
  const format = input.brief.format;
  const channel = input.brief.channel;
  const objective = input.brief.objective;
  const durationSeconds = input.brief.durationSeconds;
  if (!(['ugc', 'product-ad', 'cartoon-ad'] as unknown[]).includes(format)) {
    return reject('INVALID_FORMAT', 'Unsupported creative format');
  }
  if (!(['instagram', 'tiktok', 'youtube', 'linkedin'] as unknown[]).includes(channel)) {
    return reject('INVALID_CHANNEL', 'Unsupported channel');
  }
  if (!(['awareness', 'consideration', 'conversion'] as unknown[]).includes(objective)) {
    return reject('INVALID_OBJECTIVE', 'Unsupported objective');
  }
  if (!([15, 30, 45, 60] as unknown[]).includes(durationSeconds)) {
    return reject('INVALID_DURATION', 'Duration must be 15, 30, 45 or 60 seconds');
  }
  const audience = text(input.brief.audience, 'brief.audience', 160);
  const normalized = {
    product: { name, assetId, visualAnchors: anchors, claims },
    brief: { format, audience, objective, channel, durationSeconds },
  };
  // Workspace is part of the content address. Same proposal in different tenants is not interchangeable.
  const digest = createHash('sha256').update(JSON.stringify({ version: 1, workspaceId, normalized })).digest('hex');
  const clipCount = Math.ceil(durationSeconds / 15);
  const shots = Array.from({ length: clipCount }, (_, i) => {
    const startSeconds = Math.floor(i * durationSeconds / clipCount);
    const endSeconds = Math.floor((i + 1) * durationSeconds / clipCount);
    const role = i === 0 ? 'hook-and-fact' : i === clipCount - 1 ? 'call-to-action' : 'fact';
    const claim = claims[i % claims.length];
    const spoken = clipCount === 1
      ? name + '. ' + claim.text + '. Learn more about ' + name + '.'
      : i === 0 ? 'Meet ' + name + '. ' + claim.text + '.'
      : i === clipCount - 1 ? 'Learn more about ' + name + '.'
      : claim.text + '.';
    return {
      id: 'shot-' + String(i + 1).padStart(2, '0'),
      role,
      startSeconds,
      endSeconds,
      spoken,
      productAssetId: assetId,
      visualAnchors: anchors,
      evidence: i === clipCount - 1 && clipCount > 1 ? [] : [claim],
      actorPolicy: 'synthetic-only',
      productionStatus: 'not-generated',
    };
  });
  return {
    schemaVersion: 1,
    previewId: 'creative-v1-' + digest,
    workspaceId,
    concept: {
      name, format, audience, objective, channel,
      aspectRatio: '9:16' as const,
      durationSeconds,
      productAssetId: assetId,
      actorPolicy: 'synthetic-only' as const,
      syntheticMediaDisclosureRequired: true,
    },
    shots,
    evidenceStatus: 'user-supplied-links-not-independently-verified' as const,
    controls: {
      generationAllowed: false,
      publishingAllowed: false,
      paidMediaCallsMade: 0,
      quote: { estimatedUsd: null, status: 'not-requested' as const },
      requiredGates: [
        'human-concept-approval',
        'product-claim-and-rights-review',
        'actor-identity-and-synthetic-media-disclosure',
        'provider-model-and-cost-quote',
        'human-spend-approval',
        'render-and-output-quality-review',
        'separate-human-publish-approval',
      ],
    },
  };
}
