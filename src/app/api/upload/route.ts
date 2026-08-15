import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import {
  isR2Configured,
  r2PutBytes,
  publicUrlForKey,
} from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 4MB)" },
        { status: 400 }
      );
    }
    const type = file.type || "";
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
    }
    const ext =
      type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/gif"
            ? "gif"
            : "jpg";
    const name = `${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    if (isR2Configured()) {
      const key = `uploads/${name}`;
      await r2PutBytes(key, buf, type || `image/${ext}`);
      const url = publicUrlForKey(key);
      return NextResponse.json({ url, name, size: buf.length, storage: "r2" });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    return NextResponse.json({
      url: `/uploads/${name}`,
      name,
      size: buf.length,
      storage: "local",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 500 }
    );
  }
}
