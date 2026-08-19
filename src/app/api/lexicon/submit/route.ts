import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addPending, type LexiconItem } from "@/lib/lexiconServer";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST body:
 * {
 *   categoryId, categoryLabel?, label, items,
 *   icon?, desc?,
 *   publish?: boolean  // true = queue for admin; false = client-only (no-op server)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.publish) {
      return NextResponse.json({
        ok: true,
        mode: "local",
        message: "仅本地，无需服务端",
      });
    }

    const categoryId = String(body.categoryId || "user")
      .trim()
      .replace(/[^\w\u4e00-\u9fff\-]/g, "_")
      .slice(0, 64) || "user";
    const label = String(body.label || "").trim();
    if (!label) {
      return NextResponse.json({ error: "缺少列表名称" }, { status: 400 });
    }
    const items = (Array.isArray(body.items) ? body.items : []) as LexiconItem[];
    if (!items.length) {
      return NextResponse.json({ error: "词条为空" }, { status: 400 });
    }
    const slug =
      String(body.slug || label)
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48) || randomUUID().slice(0, 8);
    const listId = `${categoryId}/${slug}`;
    const id = randomUUID();

    const sub = await addPending({
      id,
      listId,
      categoryId,
      categoryLabel: String(body.categoryLabel || categoryId),
      label,
      path: `lists/${listId}.json`,
      items: items.map((it) => ({
        name: String(it.name || ""),
        tags: String(it.tags || ""),
        hex: it.hex ? String(it.hex) : undefined,
        image: it.image ? String(it.image) : undefined,
      })),
      icon: body.icon ? String(body.icon) : undefined,
      desc: body.desc ? String(body.desc) : undefined,
      submitterId: session.user.id,
      submitterName:
        session.user.globalName || session.user.username || session.user.id,
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      mode: "pending",
      submission: { id: sub.id, listId: sub.listId },
      message: "已提交审核，通过后会出现在公共词库",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "submit failed" },
      { status: 500 }
    );
  }
}
