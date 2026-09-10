import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { createChannel, listChannels } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

const demoChannels = [
  { id: "demo_ai", name: "AI Signal", niche: "AI and technology", handle: "@facelesscreator", timezone: "America/New_York", autoPublish: false, createdAt: new Date().toISOString() },
  { id: "demo_science", name: "Fast Science", niche: "science", handle: "@fastscience", timezone: "America/New_York", autoPublish: false, createdAt: new Date().toISOString() }
];

export async function GET(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const channels = await listChannels();
    return NextResponse.json({ channels: channels.length ? channels : isDemoMode() ? demoChannels : [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list channels" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 80);
    const niche = String(body.niche ?? "").trim().slice(0, 120);
    if (!name || !niche) return NextResponse.json({ error: "name and niche are required" }, { status: 400 });
    if (isDemoMode()) {
      return NextResponse.json({ channel: { id: `demo_${crypto.randomUUID()}`, name, niche, handle: body.handle ? String(body.handle) : null, timezone: body.timezone ?? "America/New_York", autoPublish: Boolean(body.autoPublish), createdAt: new Date().toISOString() } }, { status: 201 });
    }
    const channel = await createChannel({ name, niche, handle: body.handle ? String(body.handle).slice(0, 80) : undefined, timezone: body.timezone ? String(body.timezone).slice(0, 80) : undefined, autoPublish: Boolean(body.autoPublish) });
    if (!channel) return NextResponse.json({ error: "DATABASE_URL is required in live mode" }, { status: 503 });
    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create channel" }, { status: 500 });
  }
}
