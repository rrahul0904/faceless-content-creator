import crypto from "node:crypto";
import { cookies } from "next/headers";
import { isDemoMode } from "./config";

const COOKIE = "fcc_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.SESSION_SECRET ?? (isDemoMode() ? "demo-secret-not-for-production" : "");
}

function sign(value: string) {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is required in production");
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

export function createSessionToken(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null): { email: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { email: string; exp: number };
    if (!data.email || data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export async function currentSession() {
  if (isDemoMode()) return { email: "demo@facelesscreator.local" };
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE)?.value);
}

export async function requireApiAuth(request: Request) {
  if (isDemoMode()) return { email: "demo@facelesscreator.local" };
  const automationToken = process.env.INTERNAL_AUTOMATION_TOKEN;
  const auth = request.headers.get("authorization");
  if (automationToken && auth === `Bearer ${automationToken}`) return { email: "automation@internal" };
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return verifySessionToken(token);
}

export const sessionCookie = { name: COOKIE, maxAge: MAX_AGE };
