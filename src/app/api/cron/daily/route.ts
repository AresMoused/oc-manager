import { NextRequest, NextResponse } from "next/server";
import { runMidnightJob } from "@/lib/discord/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = req.nextUrl.searchParams.get("secret") || "";
  return bearer === secret || q === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runMidnightJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron daily", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "cron failed" },
      { status: 500 }
    );
  }
}

export const POST = GET;
