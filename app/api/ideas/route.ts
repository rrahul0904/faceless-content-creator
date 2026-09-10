import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { generateContentIdea } from "@/lib/ai";

export async function POST(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const idea = await generateContentIdea(String(body.niche ?? "science"));
    return NextResponse.json({ idea });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Idea generation failed" }, { status: 500 });
  }
}
