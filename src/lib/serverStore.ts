/**
 * Server-side JSON file storage (local disk).
 * Works with `next dev` / `next start` on a real machine or VPS.
 * Not durable on serverless (Vercel) — use self-hosted Node for shared data.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Character } from "./types";
import type { WorldMeta } from "./worlds";
import type { WorldCatalog } from "./worldCatalog";

const DATA_DIR = path.join(process.cwd(), "data");

export interface AppData {
  characters: Character[];
  worlds: WorldMeta[];
  catalog: WorldCatalog;
  updatedAt: string;
}

const DEFAULT: AppData = {
  characters: [],
  worlds: [],
  catalog: {},
  updatedAt: new Date(0).toISOString(),
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(name: string) {
  return path.join(DATA_DIR, name);
}

export async function readAppData(): Promise<AppData> {
  await ensureDir();
  try {
    const raw = await fs.readFile(filePath("app-data.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      worlds: Array.isArray(parsed.worlds) ? parsed.worlds : [],
      catalog:
        parsed.catalog && typeof parsed.catalog === "object"
          ? parsed.catalog
          : {},
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeAppData(data: AppData): Promise<AppData> {
  await ensureDir();
  const next: AppData = {
    characters: data.characters || [],
    worlds: data.worlds || [],
    catalog: data.catalog || {},
    updatedAt: new Date().toISOString(),
  };
  const tmp = filePath("app-data.json.tmp");
  const dest = filePath("app-data.json");
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
  await fs.rename(tmp, dest);
  return next;
}

export async function patchAppData(
  partial: Partial<Pick<AppData, "characters" | "worlds" | "catalog">>
): Promise<AppData> {
  const current = await readAppData();
  return writeAppData({
    ...current,
    ...partial,
  });
}
