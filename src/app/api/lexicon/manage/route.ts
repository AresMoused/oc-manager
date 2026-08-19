import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import {
  deletePublicList,
  setDefaultEnabledIds,
} from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { action: "delete" | "set-default", listId?, enabledListIds? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = await req.json();
    if (body.action === "delete") {
      const listId = String(body.listId || "").trim();
      if (!listId) {
        return NextResponse.json({ error: "missing listId" }, { status: 400 });
      }
      const result = await deletePublicList(listId);
      if (!result.ok) return NextResponse.json(result, { status: 404 });
      return NextResponse.json(result);
    }
    if (body.action === "set-default") {
      const ids = Array.isArray(body.enabledListIds)
        ? body.enabledListIds.map((x: unknown) => String(x))
        : [];
      await setDefaultEnabledIds(ids);
      return NextResponse.json({ ok: true, message: "已更新站点默认启动列表" });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
