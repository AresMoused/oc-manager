import { NextRequest, NextResponse } from "next/server";
import { claimMidnight } from "@/lib/discord/botStore";
import { runMidnightJob } from "@/lib/discord/daily";
import { hktDate } from "@/lib/inspire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.startsWith("vercel-cron/") || req.headers.get("x-vercel-cron") === "1") {
    return true;
  }
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = req.nextUrl.searchParams.get("secret") || "";
  return bearer === secret || q === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    console.error("cron daily unauthorized", {
      ua: req.headers.get("user-agent"),
      hasAuth: !!req.headers.get("authorization"),
      hasSecret: !!process.env.CRON_SECRET,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Cutover: the Odysseia-Guidance bot now owns the daily bulletin/voting.
  // The old job stays disabled unless OLD_DAILY_ENABLED=1 is set (rollback switch).
  if (process.env.OLD_DAILY_ENABLED !== "1") {
    return NextResponse.json({ ok: true, skipped: "disabled-cutover" });
  }
  try {
    const force =
      req.nextUrl.searchParams.get("force") === "1" ||
      req.nextUrl.searchParams.get("force") === "true";
    if (!force) {
      const claimed = await claimMidnight(hktDate());
      if (!claimed) {
        return NextResponse.json(
          { ok: false, skipped: "in-progress" },
          { status: 409 }
        );
      }
    }
    const result = await runMidnightJob({
      forceAnnounce: force,
      forcePost: force,
    });
    console.log("cron daily ok", result);
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
