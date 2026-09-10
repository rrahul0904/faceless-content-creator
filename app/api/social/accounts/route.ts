import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getSocialAccounts } from "@/lib/orshot";

export async function GET(request: Request) {
  if (!(await requireApiAuth(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ accounts: await getSocialAccounts() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list social accounts" }, { status: 500 });
  }
}
