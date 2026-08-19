import { NextRequest, NextResponse } from "next/server";
import { getLexiconList } from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    const list = await getLexiconList(id);
    if (!list) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "load failed" },
      { status: 500 }
    );
  }
}
