import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  canEditShare,
  deleteShare,
  getShare,
  updateShare,
  type SharePermission,
} from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const share = await getShare(id);
  if (!share) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const uid = session.user.id;
  return NextResponse.json({
    share: {
      ...share,
      isOwner: share.ownerId === uid,
      canEdit: canEditShare(share, uid),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const share = await getShare(id);
  if (!share) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (share.ownerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const permission: SharePermission | undefined =
    body.permission === "editors"
      ? "editors"
      : body.permission === "readonly"
        ? "readonly"
        : undefined;
  const editorIds = Array.isArray(body.editorIds)
    ? body.editorIds.map(String).filter((id: string) => id !== session.user.id)
    : undefined;
  const updated = await updateShare(id, {
    ...(permission ? { permission } : {}),
    ...(editorIds ? { editorIds } : {}),
  });
  return NextResponse.json({ share: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const share = await getShare(id);
  if (!share) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (share.ownerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await deleteShare(id);
  return NextResponse.json({ ok: true });
}
