import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { publishMedia } from "@/lib/orshot";
import { socialAccountIds, isDemoMode } from "@/lib/config";

export async function POST(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.mediaUrl || !body.content) return NextResponse.json({ error: "mediaUrl and content are required" }, { status: 400 });
    let accounts = Array.isArray(body.accountIds) && body.accountIds.length ? body.accountIds.map(Number) : socialAccountIds();
    if (!accounts.length && isDemoMode()) accounts = [1];
    if (!accounts.length) return NextResponse.json({ error: "No social account IDs configured" }, { status: 400 });
    const post = await publishMedia({ mediaUrl: String(body.mediaUrl), content: String(body.content), accountIds: accounts, scheduledFor: body.scheduledFor ? String(body.scheduledFor) : undefined, timezone: body.timezone ? String(body.timezone) : undefined });
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publish failed" }, { status: 500 });
  }
}
