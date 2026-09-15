import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { enforceUsageLimit, planLimitResponse } from '@/lib/limits';
import { recordUsage } from '@/lib/usage';
import { resolveWorkspace, workspaceErrorResponse } from '@/lib/workspace-context';

export const runtime = 'nodejs';

const MAX_BYTES = 100 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

export async function POST(request: Request) {
  let writtenFile: string | null = null;
  try {
    const workspace = await resolveWorkspace(request);
    const form = await request.formData();
    const upload = form.get('file');
    if (!(upload instanceof File)) return Response.json({ ok: false, error: 'multipart field `file` is required' }, { status: 400 });
    if (!MIME_EXTENSIONS[upload.type]) {
      return Response.json({ ok: false, error: `Unsupported media type: ${upload.type || 'unknown'}` }, { status: 415 });
    }
    if (upload.size <= 0 || upload.size > MAX_BYTES) {
      return Response.json({ ok: false, error: 'Media must be between 1 byte and 100MB' }, { status: 413 });
    }

    const storageMb = upload.size / BYTES_PER_MB;
    await enforceUsageLimit(workspace, 'STORAGE_MB', storageMb);

    const extension = MIME_EXTENSIONS[upload.type];
    const filename = `${workspace.id}__${randomUUID()}.${extension}`;
    const root = path.resolve(process.cwd(), 'data', 'uploads');
    await mkdir(root, { recursive: true });
    const output = path.join(root, filename);
    await writeFile(output, Buffer.from(await upload.arrayBuffer()));
    writtenFile = output;

    await recordUsage({
      workspaceId: workspace.id,
      kind: 'STORAGE_MB',
      quantity: storageMb,
      unit: 'MB',
      referenceType: 'media_upload',
      referenceId: filename,
      metadata: { filename, mimeType: upload.type, bytes: upload.size },
    });

    return Response.json({
      ok: true,
      workspaceId: workspace.id,
      media: {
        filename,
        workspaceId: workspace.id,
        mimeType: upload.type,
        bytes: upload.size,
        url: `/api/media/${encodeURIComponent(filename)}`,
        presenterRef: `/shared/uploads/${filename}`,
      },
    }, { status: 201 });
  } catch (error) {
    if (writtenFile) await unlink(writtenFile).catch(() => undefined);
    const workspaceError = workspaceErrorResponse(error);
    if (workspaceError) return workspaceError;
    const limitError = planLimitResponse(error);
    if (limitError) return limitError;
    const message = error instanceof Error ? error.message : 'Unable to upload media';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
