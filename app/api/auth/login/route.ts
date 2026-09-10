import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase();
  const password = String(body.password ?? "");
  const valid = isDemoMode()
    ? email === "demo@facelesscreator.local" && password === "demo"
    : email === String(process.env.APP_ADMIN_EMAIL ?? "").toLowerCase() && password === process.env.APP_ADMIN_PASSWORD;
  if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, createSessionToken(email), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionCookie.maxAge });
  return response;
}
