/** Rich world-setting lore (locations / factions / rules / artifacts / history / races) */

export interface LoreLocation {
  id: string;
  name: string;
  /** 大陆 / 国家 / 城市 / 地下城 / 据点 / 建筑物 … */
  type: string;
  /** 地形、天气、特产 */
  climate: string;
  /** 统治者或所属势力（自由文本，可关联势力/人物名） */
  ruler: string;
  /** 氛围标签，逗号或数组均可在 UI 里用字符串编辑 */
  tags: string[];
  notes?: string;
}

export interface LoreFaction {
  id: string;
  name: string;
  emblem: string;
  headquarters: string;
  ideology: string;
  /** 组织架构 / 核心成员描述 */
  members: string;
  /** 外交关系描述 */
  diplomacy: string;
}

export interface LoreRule {
  id: string;
  name: string;
  /** 能量来源 / 运作原理 */
  source: string;
  /** 代价与限制 */
  cost: string;
  /** 法律地位 */
  legalStatus: string;
}

export interface LoreArtifact {
  id: string;
  name: string;
  maker: string;
  holder: string;
  power: string;
  cost: string;
}

export interface LoreHistoryEvent {
  id: string;
  /** 时间 / 纪元 */
  era: string;
  name: string;
  cause: string;
  process: string;
  result: string;
  impact: string;
  location?: string;
  /** 参与角色姓名（同步到人物 timeline） */
  participants: string[];
  factions?: string[];
}

export interface LoreRace {
  id: string;
  name: string;
  physiology: string;
  culture: string;
}

export interface WorldLore {
  locations: LoreLocation[];
  factions: LoreFaction[];
  rules: LoreRule[];
  artifacts: LoreArtifact[];
  history: LoreHistoryEvent[];
  races: LoreRace[];
}

/** Keyed by world name (same as catalog / character.world) */
export type LoreMap = Record<string, WorldLore>;
/** Alias for AppDataContext compatibility */
export type WorldLoreMap = LoreMap;

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

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLocation(raw: Partial<LoreLocation> & { id?: string }): LoreLocation {
  return {
    id: str(raw.id) || cryptoRandomId(),
    name: str(raw.name),
    type: str(raw.type),
    climate: str(raw.climate),
    ruler: str(raw.ruler),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(String).filter(Boolean)
      : typeof raw.tags === "string"
        ? String(raw.tags)
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    notes: str(raw.notes) || undefined,
  };
}

function normalizeFaction(raw: Partial<LoreFaction> & { id?: string }): LoreFaction {
  return {
    id: str(raw.id) || cryptoRandomId(),
    name: str(raw.name),
    emblem: str(raw.emblem),
    headquarters: str(raw.headquarters),
    ideology: str(raw.ideology),
    members: str(raw.members),
    diplomacy: str(raw.diplomacy),
  };
}

function normalizeRule(raw: Partial<LoreRule> & { id?: string }): LoreRule {
  return {
    id: str(raw.id) || cryptoRandomId(),
    name: str(raw.name),
    source: str(raw.source),
    cost: str(raw.cost),
    legalStatus: str(raw.legalStatus),
  };
}

function normalizeArtifact(raw: Partial<LoreArtifact> & { id?: string }): LoreArtifact {
  return {
    id: str(raw.id) || cryptoRandomId(),
    name: str(raw.name),
    maker: str(raw.maker),
    holder: str(raw.holder),
    power: str(raw.power),
    cost: str(raw.cost),
  };
}

function normalizeHistory(raw: Partial<LoreHistoryEvent> & { id?: string }): LoreHistoryEvent {
  return {
    id: str(raw.id) || cryptoRandomId(),
    era: str(raw.era),
    name: str(raw.name),
    cause: str(raw.cause),
    process: str(raw.process),
    result: str(raw.result),
    impact: str(raw.impact),
    location: str(raw.location) || undefined,
    participants: Array.isArray(raw.participants)
      ? raw.participants.map(String).filter(Boolean)
      : [],
    factions: Array.isArray(raw.factions)
      ? raw.factions.map(String).filter(Boolean)
      : undefined,
  };
}

function normalizeRace(raw: Partial<LoreRace> & { id?: string }): LoreRace {
  return {
    id: str(raw.id) || cryptoRandomId(),
    name: str(raw.name),
    physiology: str(raw.physiology),
    culture: str(raw.culture),
  };
}

export function normalizeLore(raw: unknown): WorldLore {
  if (!raw || typeof raw !== "object") return emptyLore();
  const o = raw as Record<string, unknown>;
  return {
    locations: asArray<Partial<LoreLocation>>(o.locations).map(normalizeLocation),
    factions: asArray<Partial<LoreFaction>>(o.factions).map(normalizeFaction),
    rules: asArray<Partial<LoreRule>>(o.rules).map(normalizeRule),
    artifacts: asArray<Partial<LoreArtifact>>(o.artifacts).map(normalizeArtifact),
    history: asArray<Partial<LoreHistoryEvent>>(o.history).map(normalizeHistory),
    races: asArray<Partial<LoreRace>>(o.races).map(normalizeRace),
  };
}

export function normalizeLoreMap(raw: unknown): LoreMap {
  if (!raw || typeof raw !== "object") return {};
  const out: LoreMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    out[key] = normalizeLore(v);
  }
  return out;
}

export function getLore(map: LoreMap, worldName: string): WorldLore {
  const key = worldName.trim();
  if (!key) return emptyLore();
  return map[key] ? normalizeLore(map[key]) : emptyLore();
}

export function locationNames(lore: WorldLore): string[] {
  return lore.locations.map((l) => l.name).filter(Boolean);
}

export function factionNames(lore: WorldLore): string[] {
  return lore.factions.map((f) => f.name).filter(Boolean);
}

export function raceNames(lore: WorldLore): string[] {
  return lore.races.map((r) => r.name).filter(Boolean);
}

/** Merge unique strings */
export function mergeNames(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const n of list) {
      const t = n.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export function newId(): string {
  return cryptoRandomId();
}

export function newLoreId(): string {
  return cryptoRandomId();
}
