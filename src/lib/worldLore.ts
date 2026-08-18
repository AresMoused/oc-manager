/** World-building lore: locations, factions, rules, history, races */

export interface WorldLocation {
  id: string;
  name: string;
  /** 大陆 / 国家 / 城市 / 地下城 / 据点 / 建筑物 等 */
  type: string;
  /** 地形、天气、特产 */
  climate: string;
  /** 统治者或所属势力名称（可自由填或关联势力名） */
  ruler: string;
  /** 氛围标签 */
  tags: string[];
  notes: string;
}

export interface FactionRelation {
  factionId: string;
  type: "ally" | "enemy" | "neutral";
}

export interface WorldFaction {
  id: string;
  name: string;
  emblem: string;
  /** 总部地点名称 */
  headquarters: string;
  ideology: string;
  /** 核心成员角色名（自由文本，逗号分隔也行，存数组） */
  memberNames: string[];
  relations: FactionRelation[];
  notes: string;
}

export interface WorldRule {
  id: string;
  name: string;
  energySource: string;
  costLimit: string;
  legalStatus: string;
  notes: string;
}

export interface WorldArtifact {
  id: string;
  name: string;
  maker: string;
  holder: string;
  power: string;
  cost: string;
  notes: string;
}

export interface WorldHistoryEvent {
  id: string;
  era: string;
  title: string;
  cause: string;
  process: string;
  result: string;
  impact: string;
  locationName: string;
  /** 参与角色名 */
  characterNames: string[];
  /** 相关势力名 */
  factionNames: string[];
  importance?: "normal" | "major" | "critical";
}

export interface WorldRace {
  id: string;
  name: string;
  physiology: string;
  culture: string;
  notes: string;
}

export interface WorldLore {
  locations: WorldLocation[];
  factions: WorldFaction[];
  rules: WorldRule[];
  artifacts: WorldArtifact[];
  history: WorldHistoryEvent[];
  races: WorldRace[];
}

/** lore keyed by world id */
export type WorldLoreMap = Record<string, WorldLore>;
/** Alias */
export type LoreMap = WorldLoreMap;

export function emptyLore(): WorldLore {
  return {
    locations: [],
    factions: [],
    rules: [],
    artifacts: [],
    history: [],
    races: [],
  };
}

export function normalizeLore(raw: unknown): WorldLore {
  const e = emptyLore();
  if (!raw || typeof raw !== "object") return e;
  const o = raw as Partial<WorldLore>;
  return {
    locations: Array.isArray(o.locations) ? o.locations : [],
    factions: Array.isArray(o.factions) ? o.factions : [],
    rules: Array.isArray(o.rules) ? o.rules : [],
    artifacts: Array.isArray(o.artifacts) ? o.artifacts : [],
    history: Array.isArray(o.history) ? o.history : [],
    races: Array.isArray(o.races) ? o.races : [],
  };
}

export function normalizeLoreMap(raw: unknown): WorldLoreMap {
  if (!raw || typeof raw !== "object") return {};
  const out: WorldLoreMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = normalizeLore(v);
  }
  return out;
}

export function getLore(map: WorldLoreMap, worldId: string): WorldLore {
  return map[worldId] ? normalizeLore(map[worldId]) : emptyLore();
}

export function newLoreId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newId() {
  return newLoreId();
}

/** Merge legacy string catalogs into lore entity name lists for dropdowns */
export function locationNames(lore: WorldLore, catalogNames?: string[]): string[] {
  const set = new Set<string>();
  for (const l of lore.locations) if (l.name?.trim()) set.add(l.name.trim());
  for (const n of catalogNames || []) if (n?.trim()) set.add(n.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
}

export function factionNames(lore: WorldLore, catalogNames?: string[]): string[] {
  const set = new Set<string>();
  for (const f of lore.factions) if (f.name?.trim()) set.add(f.name.trim());
  for (const n of catalogNames || []) if (n?.trim()) set.add(n.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
}

export function raceNames(lore: WorldLore, catalogNames?: string[]): string[] {
  const set = new Set<string>();
  for (const r of lore.races) if (r.name?.trim()) set.add(r.name.trim());
  for (const n of catalogNames || []) if (n?.trim()) set.add(n.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
}
