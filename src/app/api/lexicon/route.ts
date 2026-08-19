import { NextResponse } from "next/server";
import {
  bootstrapLexiconToR2IfEmpty,
  getDefaultEnabledIds,
  getLexiconIndex,
} from "@/lib/lexiconServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET public lexicon catalog + default enabled list ids */
export async function GET() {
  try {
    await bootstrapLexiconToR2IfEmpty();
    const index = await getLexiconIndex();
    const defaultEnabled = await getDefaultEnabledIds();
    return NextResponse.json({ index, defaultEnabled });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "lexicon load failed" },
      { status: 500 }
    );
  }
}
