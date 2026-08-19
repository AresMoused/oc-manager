import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { reviewPending } from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { id, action: "approve" | "reject" } */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const id = String(body.id || "").trim();
    const action = body.action === "reject" ? "reject" : "approve";
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    const result = await reviewPending(id, action);
    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "review failed" },
      { status: 500 }
    );
  }
}
