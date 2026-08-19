import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { listPending } from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const pending = await listPending();
    return NextResponse.json({ pending });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
