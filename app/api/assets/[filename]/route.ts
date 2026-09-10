import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = /^[a-zA-Z0-9._-]+$/;

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await context.params;
    if (!ALLOWED.test(filename) || !filename.endsWith('.mp4')) {
      return Response.json({ ok: false, error: 'Invalid asset name' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'data', 'renders', filename);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    const bytes = await readFile(filePath);

    return new Response(bytes, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch {
    return Response.json({ ok: false, error: 'Asset not found' }, { status: 404 });
  }
}
