import { NextRequest, NextResponse } from "next/server";
import { patchAppData, readAppData, writeAppData } from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readAppData();
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "read failed" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.replace === true) {
      const data = await writeAppData({
        characters: body.characters || [],
        worlds: body.worlds || [],
        catalog: body.catalog || {},
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json(data);
    }
    const partial: Record<string, unknown> = {};
    if ("characters" in body) partial.characters = body.characters;
    if ("worlds" in body) partial.worlds = body.worlds;
    if ("catalog" in body) partial.catalog = body.catalog;
    const data = await patchAppData(partial);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 }
    );
  }
}
