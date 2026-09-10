import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getRenderJob } from "@/lib/orshot";
import { updateRenderRecord } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const job = await getRenderJob(id);
    await updateRenderRecord(id, job.status, job.mediaUrl, job.error).catch(console.error);
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render lookup failed" }, { status: 500 });
  }
}
