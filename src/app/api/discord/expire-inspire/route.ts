import { NextRequest, NextResponse } from "next/server";
import { takeExpiredEphemeral } from "@/lib/discord/botStore";
import { deleteInteractionOriginal } from "@/lib/discord/rest";

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

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const due = await takeExpiredEphemeral();
  let deleted = 0;
  for (const job of due) {
    try {
      await deleteInteractionOriginal(job.token);
      deleted++;
    } catch (e) {
      console.error("expire inspire", e);
    }
  }
  return NextResponse.json({ ok: true, due: due.length, deleted });
}

export const GET = POST;
