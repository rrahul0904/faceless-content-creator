import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";

export function GET() {
  return NextResponse.json({ ok: true, service: "faceless-content-creator", mode: isDemoMode() ? "demo" : "live", time: new Date().toISOString() });
}
