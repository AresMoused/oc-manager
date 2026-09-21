import type { Character } from "./types";
import type { WorldMeta } from "./worlds";
import type { WorldCatalog } from "./worldCatalog";
import type { LoreMap } from "./worldLore";

export interface AppData {
  characters: Character[];
  worlds: WorldMeta[];
  catalog: WorldCatalog;
  lore?: LoreMap;
  updatedAt: string;
}

export async function fetchAppData(): Promise<AppData> {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch data failed: ${res.status}`);
  return res.json();
}

export async function putCharacters(characters: Character[]): Promise<AppData> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characters }),
  });
  if (!res.ok) throw new Error(`Save characters failed: ${res.status}`);
  return res.json();
}

export async function putWorlds(worlds: WorldMeta[]): Promise<AppData> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worlds }),
  });
  if (!res.ok) throw new Error(`Save worlds failed: ${res.status}`);
  return res.json();
}

export async function putCatalog(catalog: WorldCatalog): Promise<AppData> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalog }),
  });
  if (!res.ok) throw new Error(`Save catalog failed: ${res.status}`);
  return res.json();
}

export async function migrateLocalToServer(payload: {
  characters: Character[];
  worlds: WorldMeta[];
  catalog: WorldCatalog;
}): Promise<AppData> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, replace: true }),
  });
  if (!res.ok) throw new Error(`Migrate failed: ${res.status}`);
  return res.json();
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

export function assertImageFile(file: File): void {
  const type = (file.type || "").toLowerCase();
  const looksImage =
    ALLOWED_IMAGE_TYPES.has(type) ||
    (type.startsWith("image/") && type !== "image/svg+xml");
  if (!looksImage) {
    throw new Error("只能上传图片（png / jpg / gif / webp 等）");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("图片不能超过 10MB");
  }
}

export async function uploadImage(file: File): Promise<string> {
  assertImageFile(file);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.url as string;
}
