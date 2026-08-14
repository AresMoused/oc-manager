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
  partial: Partial<Pick<AppData, "characters" | "worlds" | "catalog">> & {
    forceEmpty?: boolean;
  }
): Promise<AppData> {
  const current = await readAppData();
  const force = partial.forceEmpty === true;

  let nextCharacters = current.characters;
  if ("characters" in partial && Array.isArray(partial.characters)) {
    if (
      partial.characters.length === 0 &&
      current.characters.length > 0 &&
      !force
    ) {
      console.warn(
        "[serverStore] blocked empty characters overwrite (had",
        current.characters.length,
        "items)"
      );
      nextCharacters = current.characters;
    } else {
      nextCharacters = partial.characters;
    }
  }

  let nextWorlds = current.worlds;
  if ("worlds" in partial && Array.isArray(partial.worlds)) {
    if (partial.worlds.length === 0 && current.worlds.length > 0 && !force) {
      console.warn(
        "[serverStore] blocked empty worlds overwrite (had",
        current.worlds.length,
        "items)"
      );
      nextWorlds = current.worlds;
    } else {
      nextWorlds = partial.worlds;
    }
  }

  const nextCatalog =
    "catalog" in partial &&
    partial.catalog &&
    typeof partial.catalog === "object"
      ? partial.catalog
      : current.catalog;

  return writeAppData({
    characters: nextCharacters || [],
    worlds: nextWorlds || [],
    catalog: nextCatalog || {},
    updatedAt: new Date().toISOString(),
  });
}
