import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

async function commandHealthy(command: string, args: string[]) {
  try {
    await execFileAsync(command, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [database, ffmpeg, ffprobe, tts] = await Promise.all([
    db.renderJob.count().then(() => true).catch(() => false),
    commandHealthy('ffmpeg', ['-version']),
    commandHealthy('ffprobe', ['-version']),
    commandHealthy('espeak-ng', ['--version']),
  ]);

  const dependencies = { database, ffmpeg, ffprobe, tts };
  const ok = Object.values(dependencies).every(Boolean);

  return Response.json({
    ok,
    service: 'faceless-content-creator',
    mode: 'zero-config-local',
    renderer: 'ffmpeg',
    voice: 'espeak-ng',
    persistence: 'sqlite',
    dependencies,
  }, { status: ok ? 200 : 503 });
}
