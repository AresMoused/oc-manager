/** Client-side thumbnail / avatar compression helpers (browser only). */

export const GALLERY_THUMB_MAX_EDGE = 720;
export const AVATAR_MAX_EDGE = 512;
export const THUMB_QUALITY = 0.78;

async function canvasToFile(
  canvas: HTMLCanvasElement,
  nameHint: string
): Promise<File> {
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", THUMB_QUALITY);
  if (!blob?.size) blob = await toBlob("image/jpeg", THUMB_QUALITY);
  if (!blob?.size) throw new Error("无法产生缩图");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base =
    String(nameHint || "thumb")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 80) || "thumb";
  return new File([blob], `${base}-thumb.${ext}`, { type: blob.type });
}

export async function makeThumbnailFile(
  source: File | string,
  opts: { maxEdge?: number; nameHint?: string } = {}
): Promise<File> {
  const maxEdge = opts.maxEdge ?? GALLERY_THUMB_MAX_EDGE;
  const isUrl = typeof source === "string";
  const objectUrl = isUrl ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    if (isUrl) image.crossOrigin = "anonymous";
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(
      1,
      maxEdge / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const hint =
      opts.nameHint ||
      (isUrl ? "thumb" : (source as File).name || "thumb");
    return canvasToFile(canvas, hint);
  } finally {
    if (!isUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Shrink a file for avatar upload (single URL, no separate original kept). */
export async function compressImageFile(
  file: File,
  maxEdge = AVATAR_MAX_EDGE
): Promise<File> {
  try {
    return await makeThumbnailFile(file, {
      maxEdge,
      nameHint: file.name || "avatar",
    });
  } catch {
    return file;
  }
}
