import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  canEditShare,
  getShare,
  readShareContent,
  writeShareCharacters,
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
  const content = await readShareContent(share);
  return NextResponse.json({
    share: {
      ...share,
      isOwner: share.ownerId === session.user.id,
      canEdit: canEditShare(share, session.user.id),
    },
    ...content,
  });
}

export async function PUT(
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
  if (!canEditShare(share, session.user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const characters = Array.isArray(body.characters) ? body.characters : [];
  const content = await writeShareCharacters(share, characters);
  return NextResponse.json({
    share: {
      ...share,
      isOwner: share.ownerId === session.user.id,
      canEdit: true,
    },
    ...content,
  });
}
