import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { listContentItems } from "@/lib/db";

export async function GET(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return NextResponse.json({ items: await listContentItems(Number.isFinite(limit) ? limit : 50) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list content" }, { status: 500 });
  }
}
