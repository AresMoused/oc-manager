import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createShare,
  listShares,
  readUserAppData,
  type SharePermission,
} from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const shares = await listShares();
  const uid = session.user.id;
  const enriched = shares.map((s) => ({
    ...s,
    isOwner: s.ownerId === uid,
    canEdit:
      s.ownerId === uid ||
      (s.permission === "editors" && s.editorIds.includes(uid)),
  }));
  return NextResponse.json({ shares: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const worldId = String(body.worldId || "");
    if (!worldId) {
      return NextResponse.json({ error: "worldId required" }, { status: 400 });
    }
    const permission: SharePermission =
      body.permission === "editors" ? "editors" : "readonly";
    const editorIds: string[] = Array.isArray(body.editorIds)
      ? body.editorIds.map(String)
      : [];

    const data = await readUserAppData(session.user.id);
    const world = data.worlds.find((w) => w.id === worldId);
    if (!world) {
      return NextResponse.json({ error: "world not found" }, { status: 404 });
    }

    const share = await createShare({
      owner: session.user,
      world,
      permission,
      editorIds: editorIds.filter((id) => id !== session.user.id),
    });
    return NextResponse.json({ share });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "share failed" },
      { status: 500 }
    );
  }
}
