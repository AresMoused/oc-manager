/** Per-world option catalogs for basic info fields */

export type OptionField =
  | "genders"
  | "races"
  | "affiliations"
  | "birthplaces"
  | "residences"
  | "factions";

export interface WorldCatalogEntry {
  genders: string[];
  races: string[];
  affiliations: string[];
  birthplaces: string[];
  residences: string[];
  factions: string[];
}

export type WorldCatalog = Record<string, WorldCatalogEntry>;

const STORAGE_KEY = "oc-manager-world-catalog-v1";

const EMPTY: WorldCatalogEntry = {
  genders: [],
  races: [],
  affiliations: [],
  birthplaces: [],
  residences: [],
  factions: [],
};

export function loadWorldCatalog(): WorldCatalog {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultCatalog();
    return JSON.parse(raw) as WorldCatalog;
  } catch {
    return getDefaultCatalog();
  }
}

export function saveWorldCatalog(catalog: WorldCatalog) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch (e) {
    console.warn("Failed to save world catalog", e);
  }
}

export function getDefaultCatalog(): WorldCatalog {
  return {
    "绿叶边境": {
      genders: ["女", "男", "非二元", "未知"],
      races: ["精灵", "半精灵", "人类", "矮人", "兽人"],
      affiliations: ["中立善良", "混乱善良", "守序中立", "中立", "混乱中立"],
      birthplaces: ["溪木镇", "银叶城", "迷雾森林", "边境哨站"],
      residences: ["溪木镇", "银叶城", "流浪"],
      factions: ["巡游斥候", "自由佣兵", "无"],
    },
  };
}

export function ensureWorld(catalog: WorldCatalog, world: string): WorldCatalog {
  const key = world.trim();
  if (!key) return catalog;
  if (catalog[key]) return catalog;
  return { ...catalog, [key]: { ...EMPTY, genders: ["女", "男", "未知"] } };
}

export function addOption(
  catalog: WorldCatalog,
  world: string,
  field: OptionField,
  value: string
): WorldCatalog {
  const key = world.trim() || "__default__";
  const entry = catalog[key]
    ? { ...EMPTY, ...catalog[key] }
    : { ...EMPTY };
  const list = entry[field] || [];
  const v = value.trim();
  if (!v || list.includes(v)) {
    return ensureWorld(catalog, key === "__default__" ? "" : key);
  }
  return {
    ...catalog,
    [key]: {
      ...entry,
      [field]: [...list, v],
    },
  };
}

export function getOptions(
  catalog: WorldCatalog,
  world: string,
  field: OptionField
): string[] {
  const key = world.trim() || "__default__";
  return catalog[key]?.[field] ?? catalog["__default__"]?.[field] ?? [];
}

export function listWorlds(catalog: WorldCatalog): string[] {
  return Object.keys(catalog)
    .filter((k) => k !== "__default__")
    .sort();
}
