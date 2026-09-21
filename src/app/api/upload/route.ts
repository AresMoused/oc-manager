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
const MAX_BYTES = 10 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const ALLOWED_EXT = new Set(Object.values(MIME_EXT));

function originalExt(file: File): string | null {
  const fromName = path.extname(file.name || "").replace(/^\./, "").toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (ALLOWED_EXT.has(fromName)) return fromName;
  return MIME_EXT[(file.type || "").toLowerCase()] || null;
}

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
        { error: "图片不能超过 10MB" },
        { status: 400 }
      );
    }
    const type = (file.type || "").toLowerCase();
    if (!type.startsWith("image/") || type === "image/svg+xml") {
      return NextResponse.json({ error: "只能上传图片" }, { status: 400 });
    }
    const ext = originalExt(file);
    if (!ext) {
      return NextResponse.json(
        { error: "不支持的图片格式（png / jpg / gif / webp 等）" },
        { status: 400 }
      );
    }
    const name = `${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = MIME_EXT[type] ? type : `image/${ext === "jpg" ? "jpeg" : ext}`;

    if (isR2Configured()) {
      const key = `uploads/${name}`;
      await r2PutBytes(key, buf, contentType);
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
