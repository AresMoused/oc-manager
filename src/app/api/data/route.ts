import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  patchUserAppData,
  readUserAppData,
  writeUserAppData,
} from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET current user's dataset */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const data = await readUserAppData(session.user.id);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "read failed" },
      { status: 500 }
    );
  }
}

/**
 * PUT body:
 * { characters?, worlds?, catalog?, replace?: boolean }
 * If replace=true, missing fields become empty; otherwise merge/patch provided keys.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json();
    if (body.replace === true) {
      const data = await writeUserAppData(userId, {
        characters: body.characters || [],
        worlds: body.worlds || [],
        catalog: body.catalog || {},
        lore: body.lore || {},
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json(data);
    }
    const partial: Record<string, unknown> = {};
    if ("characters" in body) partial.characters = body.characters;
    if ("worlds" in body) partial.worlds = body.worlds;
    if ("catalog" in body) partial.catalog = body.catalog;
    if ("lore" in body) partial.lore = body.lore;
    const data = await patchUserAppData(userId, partial);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 }
    );
  }
}
