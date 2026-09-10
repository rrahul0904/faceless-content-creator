import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getSocialAnalytics, getSocialInsights } from "@/lib/orshot";

export async function GET(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [analytics, insights] = await Promise.all([getSocialAnalytics(), getSocialInsights()]);
    return NextResponse.json({ analytics, insights });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics failed" }, { status: 500 });
  }
}
