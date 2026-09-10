import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = /^[a-zA-Z0-9._-]+$/;

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const rawStart = match[1];
  const rawEnd = match[2];
  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : size - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return null;
  }

  end = Math.min(end, size - 1);
  return { start, end };
}

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await context.params;
    if (!ALLOWED.test(filename) || !filename.endsWith('.mp4')) {
      return Response.json({ ok: false, error: 'Invalid asset name' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'data', 'renders', filename);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');

    const bytes = await readFile(filePath);
    const range = parseRange(request.headers.get('range'), bytes.length);
    const baseHeaders = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${filename}"`,
    };

    if (request.headers.has('range') && !range) {
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${bytes.length}` },
      });
    }

    if (range) {
      const chunk = bytes.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}`,
        },
      });
    }

    return new Response(new Uint8Array(bytes), {
      headers: { ...baseHeaders, 'Content-Length': String(bytes.length) },
    });
  } catch {
    return Response.json({ ok: false, error: 'Asset not found' }, { status: 404 });
  }
}
