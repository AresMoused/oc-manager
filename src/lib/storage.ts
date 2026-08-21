import {
  Character,
  migratePreferences,
  migrateTraits,
  migrateEmotions,
  migrateHappiness,
  migrateOutward,
  normalizeModules,
  legacyFieldsFromModules,
} from "./types";

const STORAGE_KEY = "oc-manager-characters-v1";

export function normalizeCharacter(c: Character): Character {
  const traits = migrateTraits(c.traits);
  const preferences = migratePreferences(c.preferences);
  const combat = c.combat || {
    experience: 50,
    collaboration: 50,
    conflict: 50,
    intelligence: 50,
    adaptability: 50,
  };
  const modules = normalizeModules(
    (c as { modules?: unknown }).modules,
    { traits, combat, preferences }
  );
  const legacy = legacyFieldsFromModules(modules, { traits, combat, preferences });
  return {
    ...c,
    world: c.world ?? "",
    residence: (c as { residence?: string }).residence ?? "",
    faction: (c as { faction?: string }).faction ?? "",
    gallery: Array.isArray(c.gallery) ? c.gallery : [],
    prompts: Array.isArray((c as { prompts?: unknown }).prompts)
      ? ((c as { prompts: Character["prompts"] }).prompts)
      : [],
    preferences: legacy.preferences,
    traits: legacy.traits,
    combat: legacy.combat,
    emotions: migrateEmotions(c.emotions),
    happiness: migrateHappiness(c.happiness),
    outward: migrateOutward(c.outward),
    modules,
    story: c.story ?? "",
  };
}

export function normalizeCharacterList(list: unknown): Character[] {
  if (!Array.isArray(list)) return [];
  return (list as Character[]).map(normalizeCharacter);
}

export function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Character[];
    return parsed.map(normalizeCharacter);
  } catch {
    return [];
  }
}

export function saveCharacters(chars: Character[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  } catch (err) {
    console.warn("localStorage quota exceeded", err);
  }
}

export function createId(): string {
  return crypto.randomUUID();
}

/** Flat array export (legacy) */
export function exportCharacters(chars: Character[]): string {
  return JSON.stringify(chars, null, 2);
}

/** Hierarchical export grouped by world folders */
export function exportByWorld(chars: Character[]): string {
  const worlds: Record<string, { characters: Character[] }> = {};
  const unassigned: Character[] = [];
  for (const c of chars) {
    const w = c.world?.trim();
    if (!w) {
      unassigned.push(c);
      continue;
    }
    if (!worlds[w]) worlds[w] = { characters: [] };
    worlds[w].characters.push(c);
  }
  return JSON.stringify(
    {
      version: 2,
      format: "oc-manager-world-folders",
      exportedAt: new Date().toISOString(),
      worlds,
      unassigned,
    },
    null,
    2
  );
}

export function importCharacters(json: string): Character[] {
  const data = JSON.parse(json);
  if (
    data &&
    typeof data === "object" &&
    data.format === "oc-manager-world-folders"
  ) {
    const list: Character[] = [];
    const worlds = data.worlds || {};
    for (const [worldName, folder] of Object.entries(worlds) as [
      string,
      { characters?: Character[] }
    ][]) {
      for (const c of folder.characters || []) {
        list.push(normalizeCharacter({ ...c, world: c.world || worldName }));
      }
    }
    for (const c of data.unassigned || []) {
      list.push(normalizeCharacter(c));
    }
    return list;
  }
  if (!Array.isArray(data)) throw new Error("Invalid format");
  return (data as Character[]).map(normalizeCharacter);
}

/** Single character card export */
export function exportSingleCharacter(c: Character): string {
  return JSON.stringify(
    {
      version: 3,
      format: "oc-manager-single-character",
      exportedAt: new Date().toISOString(),
      character: normalizeCharacter(c),
    },
    null,
    2
  );
}

/** Parse import JSON into characters (single / array / world-folders) */
export function importCharacterPayload(json: string): Character[] {
  const data = JSON.parse(json);
  if (
    data &&
    typeof data === "object" &&
    data.format === "oc-manager-single-character"
  ) {
    return [normalizeCharacter(data.character)];
  }
  return importCharacters(json);
}

/** Full database dump */
export function exportFullDatabase(payload: {
  characters: Character[];
  worlds: unknown[];
  catalog: unknown;
}): string {
  return JSON.stringify(
    {
      version: 4,
      format: "oc-manager-full-database",
      exportedAt: new Date().toISOString(),
      characters: (payload.characters || []).map(normalizeCharacter),
      worlds: payload.worlds || [],
      catalog: payload.catalog || {},
    },
    null,
    2
  );
}

export function importFullDatabase(json: string): {
  characters: Character[];
  worlds: unknown[];
  catalog: unknown;
} {
  const data = JSON.parse(json);
  if (
    data &&
    typeof data === "object" &&
    data.format === "oc-manager-full-database"
  ) {
    return {
      characters: normalizeCharacterList(data.characters),
      worlds: Array.isArray(data.worlds) ? data.worlds : [],
      catalog:
        data.catalog && typeof data.catalog === "object" ? data.catalog : {},
    };
  }
  return {
    characters: importCharacters(json),
    worlds: [],
    catalog: {},
  };
}

export function downloadExport(filename: string, content: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
