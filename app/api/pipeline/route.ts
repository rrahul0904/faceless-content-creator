import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { generateContentIdea } from "@/lib/ai";
import { createPresenterVideo, startShortRender } from "@/lib/orshot";
import { socialAccountIds, isDemoMode } from "@/lib/config";
import { recordPipelineRun } from "@/lib/db";
import type { PipelineRequest, PipelineResult } from "@/lib/types";

export async function POST(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as PipelineRequest;
    const niche = String(body.niche ?? "AI and technology").slice(0, 120);
    const idea = await generateContentIdea(niche);
    const presenterUrl = body.mode === "broll" ? undefined : await createPresenterVideo(idea.script);
    const accounts = body.accountIds?.length ? body.accountIds : socialAccountIds();
    const render = await startShortRender({ idea, clipUrl: presenterUrl, autoPublish: Boolean(body.autoPublish), accountIds: accounts, scheduledFor: body.scheduledFor, timezone: body.timezone });
    await recordPipelineRun({ idea, renderJobId: render.id, status: render.status, autoPublish: Boolean(body.autoPublish), channelId: body.channelId }).catch(console.error);
    const result: PipelineResult = {
      mode: isDemoMode() ? "demo" : "live",
      idea,
      presenterUrl,
      renderJobId: render.id,
      renderStatus: render.status,
      previewUrl: isDemoMode() ? "mock://render/faceless-short.mp4" : undefined,
      publishRequested: Boolean(body.autoPublish),
      createdAt: new Date().toISOString()
    };
    return NextResponse.json(result, { status: isDemoMode() ? 200 : 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pipeline failed" }, { status: 500 });
  }
}
