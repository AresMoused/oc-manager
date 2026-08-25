import { NextRequest, NextResponse } from "next/server";
import { ingestSubmission } from "@/lib/discord/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Railway sidecar posts MESSAGE_CREATE payloads here. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const result = await ingestSubmission(body as Parameters<typeof ingestSubmission>[0]);
    return NextResponse.json(result);
  } catch (e) {
    console.error("ingest", e);
    return NextResponse.json(
      { ok: false, reason: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
