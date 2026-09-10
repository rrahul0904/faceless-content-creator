import { createDecipheriv, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const MAX_BUFFERED_VIDEO = 256 * 1024 * 1024;

function encryptionKey() {
  const secret = process.env.SOCIAL_TOKEN_KEY || process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error('SOCIAL_TOKEN_KEY (or APP_SECRET) is required to decrypt social credentials');
  return createHash('sha256').update(secret).digest();
}

function decryptToken(value) {
  if (!value) throw new Error('Social account does not contain an access token');
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Unsupported social token encryption format');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function metadataOf(account) {
  return account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata) ? account.metadata : {};
}

function absoluteAssetUrl(videoUrl) {
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl;
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error('APP_BASE_URL is required for Instagram/TikTok publishing because they fetch the rendered video from a public URL');
  return new URL(videoUrl, base.endsWith('/') ? base : `${base}/`).toString();
}

async function videoBytes(videoUrl) {
  if (videoUrl.startsWith('/api/assets/')) {
    const filename = decodeURIComponent(videoUrl.slice('/api/assets/'.length));
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error('Rendered asset path is invalid');
    const file = path.resolve(process.cwd(), 'data', 'renders', filename);
    const bytes = await readFile(file);
    if (bytes.length > MAX_BUFFERED_VIDEO) throw new Error('YouTube multipart uploader currently supports rendered files up to 256MB');
    return bytes;
  }

  const response = await fetch(absoluteAssetUrl(videoUrl), { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Unable to fetch rendered video (${response.status})`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_BUFFERED_VIDEO) throw new Error('YouTube multipart uploader currently supports rendered files up to 256MB');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BUFFERED_VIDEO) throw new Error('YouTube multipart uploader currently supports rendered files up to 256MB');
  return bytes;
}

function titleFor(content) {
  const value = String(content.hook || content.topic || 'Faceless short').trim();
  return value.slice(0, 100);
}

function captionFor(content) {
  return String(content.caption || content.script || content.topic || '').trim().slice(0, 5000);
}

async function publishYouTube(account, content, accessToken) {
  const bytes = await videoBytes(content.videoUrl);
  const boundary = `faceless_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata = {
    snippet: {
      title: titleFor(content),
      description: captionFor(content),
      categoryId: String(metadataOf(account).categoryId || '22'),
    },
    status: {
      privacyStatus: String(metadataOf(account).privacyStatus || 'private'),
      selfDeclaredMadeForKids: Boolean(metadataOf(account).madeForKids || false),
    },
  };
  const header = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, bytes, footer]);
  const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new Error(`YouTube upload failed (${response.status}): ${JSON.stringify(result)}`);
  return { externalId: String(result.id), raw: result };
}

function instagramBase(account) {
  const metadata = metadataOf(account);
  const host = String(metadata.apiHost || 'graph.facebook.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const version = metadata.apiVersion ? `${String(metadata.apiVersion).replace(/^\//, '').replace(/\/$/, '')}/` : '';
  return `https://${host}/${version}`;
}

async function publishInstagram(account, content, accessToken) {
  const metadata = metadataOf(account);
  const userId = String(metadata.igUserId || metadata.userId || '').trim();
  if (!userId) throw new Error('Instagram account metadata must contain igUserId');
  const base = instagramBase(account);
  const createBody = new URLSearchParams({
    access_token: accessToken,
    media_type: 'REELS',
    video_url: absoluteAssetUrl(content.videoUrl),
    caption: captionFor(content).slice(0, 2200),
    share_to_feed: String(metadata.shareToFeed !== false),
  });
  const createResponse = await fetch(`${base}${encodeURIComponent(userId)}/media`, {
    method: 'POST',
    body: createBody,
    signal: AbortSignal.timeout(120_000),
  });
  const created = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !created.id) throw new Error(`Instagram container creation failed (${createResponse.status}): ${JSON.stringify(created)}`);
  const containerId = String(created.id);

  let status = 'IN_PROGRESS';
  let statusPayload = created;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const statusUrl = new URL(`${base}${encodeURIComponent(containerId)}`);
    statusUrl.searchParams.set('fields', 'status_code,status');
    statusUrl.searchParams.set('access_token', accessToken);
    const statusResponse = await fetch(statusUrl, { signal: AbortSignal.timeout(30_000) });
    statusPayload = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) throw new Error(`Instagram container status failed (${statusResponse.status}): ${JSON.stringify(statusPayload)}`);
    status = String(statusPayload.status_code || '');
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram container ${status.toLowerCase()}: ${JSON.stringify(statusPayload)}`);
  }
  if (status !== 'FINISHED') throw new Error('Instagram container did not become ready before the publish timeout');

  const publishResponse = await fetch(`${base}${encodeURIComponent(userId)}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: accessToken, creation_id: containerId }),
    signal: AbortSignal.timeout(60_000),
  });
  const published = await publishResponse.json().catch(() => ({}));
  if (!publishResponse.ok || !published.id) throw new Error(`Instagram publish failed (${publishResponse.status}): ${JSON.stringify(published)}`);
  return { externalId: String(published.id), raw: { containerId, status: statusPayload, published } };
}

async function publishTikTok(account, content, accessToken) {
  const metadata = metadataOf(account);
  const privacy = String(metadata.privacyLevel || 'SELF_ONLY');
  const payload = {
    post_info: {
      title: captionFor(content).slice(0, 2200),
      privacy_level: privacy,
      disable_duet: Boolean(metadata.disableDuet || false),
      disable_comment: Boolean(metadata.disableComment || false),
      disable_stitch: Boolean(metadata.disableStitch || false),
      video_cover_timestamp_ms: Number(metadata.coverTimestampMs || 1000),
      is_aigc: metadata.isAigc !== false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: absoluteAssetUrl(content.videoUrl),
    },
  };
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json().catch(() => ({}));
  const errorCode = result?.error?.code;
  const publishId = result?.data?.publish_id;
  if (!response.ok || (errorCode && errorCode !== 'ok') || !publishId) {
    throw new Error(`TikTok publish initialization failed (${response.status}): ${JSON.stringify(result)}`);
  }
  return { externalId: String(publishId), raw: result };
}

async function updateContentState(contentId) {
  const publications = await db.publication.findMany({ where: { contentId } });
  if (!publications.length) return;
  const statuses = publications.map((item) => item.status);
  if (statuses.every((status) => status === 'PUBLISHED')) {
    await db.contentItem.update({ where: { id: contentId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    return;
  }
  if (statuses.some((status) => status === 'QUEUED' || status === 'RUNNING' || status === 'SCHEDULED')) return;
  if (statuses.some((status) => status === 'PUBLISHED')) {
    await db.contentItem.update({ where: { id: contentId }, data: { status: 'APPROVED' } });
    return;
  }
  await db.contentItem.update({ where: { id: contentId }, data: { status: 'FAILED' } });
}

export async function publishPublication(publicationId) {
  const claimed = await db.publication.updateMany({
    where: { id: publicationId, status: { in: ['QUEUED', 'RETRY'] } },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (!claimed.count) return { ok: false, skipped: true, reason: 'Publication is not queued' };

  const publication = await db.publication.findUnique({
    where: { id: publicationId },
    include: { content: true },
  });
  if (!publication) throw new Error(`Publication ${publicationId} disappeared after claim`);

  try {
    const account = await db.socialAccount.findUnique({ where: { id: publication.accountId } });
    if (!account) throw new Error('Target social account no longer exists');
    if (account.status !== 'connected') throw new Error(`Target social account is ${account.status}`);
    if (!publication.content.videoUrl) throw new Error('Content does not have a rendered video');
    const accessToken = decryptToken(account.accessTokenEncrypted);

    let result;
    if (account.platform === 'youtube') result = await publishYouTube(account, publication.content, accessToken);
    else if (account.platform === 'instagram') result = await publishInstagram(account, publication.content, accessToken);
    else if (account.platform === 'tiktok') result = await publishTikTok(account, publication.content, accessToken);
    else throw new Error(`Unsupported social platform: ${account.platform}`);

    await db.publication.update({
      where: { id: publicationId },
      data: {
        status: 'PUBLISHED',
        externalId: result.externalId,
        raw: JSON.parse(JSON.stringify(result.raw)),
        publishedAt: new Date(),
        lastError: null,
      },
    });
    await updateContentState(publication.contentId);
    return { ok: true, publicationId, platform: account.platform, externalId: result.externalId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.publication.update({ where: { id: publicationId }, data: { status: 'FAILED', lastError: message } });
    await updateContentState(publication.contentId);
    throw error;
  }
}

export async function processDuePublications(limit = 25) {
  const due = await db.publication.findMany({
    where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: 'asc' },
    take: Math.max(1, Math.min(limit, 100)),
  });
  const results = [];
  for (const publication of due) {
    await db.publication.updateMany({ where: { id: publication.id, status: 'SCHEDULED' }, data: { status: 'QUEUED' } });
    try {
      results.push(await publishPublication(publication.id));
    } catch (error) {
      results.push({ ok: false, publicationId: publication.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export async function retryFailedPublication(publicationId) {
  const publication = await db.publication.update({
    where: { id: publicationId },
    data: { status: 'RETRY', lastError: null },
  });
  return publishPublication(publication.id);
}

export async function disconnect() {
  await db.$disconnect();
}
