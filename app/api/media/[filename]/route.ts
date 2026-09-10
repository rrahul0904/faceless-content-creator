import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
};

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await context.params;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return new Response('Not found', { status: 404 });
    const root = path.resolve(process.cwd(), 'data', 'uploads');
    const file = path.resolve(root, filename);
    if (!file.startsWith(`${root}${path.sep}`)) return new Response('Not found', { status: 404 });
    const info = await stat(file);
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';
    const range = request.headers.get('range');

    if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= info.size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
      }
      const bytes = await readFile(file);
      const chunk = bytes.subarray(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${info.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const bytes = await readFile(file);
    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
