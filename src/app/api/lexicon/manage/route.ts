import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import {
  deletePublicList,
  setDefaultEnabledIds,
  updateListMeta,
  updateListContent,
  reorderCategories,
  renameCategory,
  publishListDirect,
  bulkUpdateFilterTags,
} from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST actions:
 * - delete: { listId }
 * - set-default: { enabledListIds }
 * - update-meta: { listId, label?, categoryId?, categoryLabel?, icon?, desc?, filterTags? }
 * - update-content: { listId, items: [{name,tags,...}], label? }
 * - reorder: { categories: [{id,label,lists:[{id,label,...}]}] }
 * - rename-category: { categoryId, label }
 * - bulk-filter-tags: { listIds, mode: "set"|"add"|"remove"|"clear", filterTags? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "delete") {
      const listId = String(body.listId || "").trim();
      if (!listId) {
        return NextResponse.json({ error: "missing listId" }, { status: 400 });
      }
      const result = await deletePublicList(listId);
      if (!result.ok) return NextResponse.json(result, { status: 404 });
      return NextResponse.json(result);
    }

    if (action === "set-default") {
      const ids = Array.isArray(body.enabledListIds)
        ? body.enabledListIds.map((x: unknown) => String(x))
        : [];
      await setDefaultEnabledIds(ids);
      return NextResponse.json({ ok: true, message: "已更新站点默认启动列表" });
    }

    if (action === "update-meta") {
      const listId = String(body.listId || "").trim();
      if (!listId) {
        return NextResponse.json({ error: "missing listId" }, { status: 400 });
      }
      const result = await updateListMeta({
        listId,
        label: body.label,
        categoryId: body.categoryId,
        categoryLabel: body.categoryLabel,
        icon: body.icon,
        desc: body.desc,
        filterTags: Array.isArray(body.filterTags)
          ? body.filterTags.map((x: unknown) => String(x))
          : typeof body.filterTags === "string"
            ? body.filterTags.split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean)
            : undefined,
      });
      if (!result.ok) return NextResponse.json(result, { status: 404 });
      return NextResponse.json(result);
    }

    if (action === "update-content") {
      const listId = String(body.listId || "").trim();
      if (!listId) {
        return NextResponse.json({ error: "missing listId" }, { status: 400 });
      }
      if (!Array.isArray(body.items)) {
        return NextResponse.json({ error: "missing items" }, { status: 400 });
      }
      const result = await updateListContent(listId, body.items, body.label);
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === "reorder") {
      if (!Array.isArray(body.categories)) {
        return NextResponse.json({ error: "missing categories" }, { status: 400 });
      }
      const result = await reorderCategories(body.categories);
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === "rename-category") {
      const categoryId = String(body.categoryId || "").trim();
      const label = String(body.label || "").trim();
      if (!categoryId) {
        return NextResponse.json({ error: "missing categoryId" }, { status: 400 });
      }
      const result = await renameCategory(categoryId, label);
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === "publish-direct") {
      const result = await publishListDirect({
        categoryId: body.categoryId,
        categoryLabel: body.categoryLabel,
        label: body.label,
        items: Array.isArray(body.items) ? body.items : [],
        icon: body.icon,
        desc: body.desc,
        listId: body.listId,
      });
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === "bulk-filter-tags") {
      const listIds = Array.isArray(body.listIds)
        ? body.listIds.map((x: unknown) => String(x))
        : [];
      const modeRaw = String(body.mode || "set");
      const mode =
        modeRaw === "add" || modeRaw === "remove" || modeRaw === "clear"
          ? modeRaw
          : "set";
      const tags = Array.isArray(body.filterTags)
        ? body.filterTags.map((x: unknown) => String(x))
        : typeof body.filterTags === "string"
          ? body.filterTags.split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean)
          : [];
      const result = await bulkUpdateFilterTags({ listIds, mode, tags });
      if (!result.ok) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
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
