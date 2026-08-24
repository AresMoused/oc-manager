import type { DndSpellPreset } from "@/systems/dnd5e/schema";
import { DEFAULT_SPELL_PRESETS, mergeCoreSpellPresets } from "@/systems/dnd5e/spellPresets";

/** World metadata — top-level partition for all data */

export type WorldSystem = "generic" | "dnd5e" | "coc7" | "cyberpunk";

export const WORLD_SYSTEMS: { id: WorldSystem; label: string }[] = [
  { id: "generic", label: "通用" },
  { id: "dnd5e", label: "D&D 5e" },
  { id: "coc7", label: "克苏鲁的呼唤" },
  { id: "cyberpunk", label: "赛博朋克" },
];

export function worldSystemLabel(id?: string): string {
  return WORLD_SYSTEMS.find((s) => s.id === id)?.label || "通用";
}

export function normalizeWorldSystem(v: unknown): WorldSystem {
  if (v === "dnd5e" || v === "coc7" || v === "cyberpunk") return v;
  return "generic";
}

export interface WorldMeta {
  id: string;
  name: string;
  /** Accent color for this world (hex) */
  color: string;
  /** Character-card profile. generic = current OC sheet. */
  system: WorldSystem;
  /** Character ids the DM chose to show on the DM page */
  dmRoster: string[];
  /** D&D 5e spell library for this world (DM-managed) */
  spellPresets: DndSpellPreset[];
  createdAt: string;
  updatedAt: string;
}

const WORLDS_KEY = "oc-manager-worlds-meta-v1";

export const WORLD_COLOR_PALETTE = [
  "#a78bfa", // purple
  "#38bdf8", // sky
  "#34d399", // emerald
  "#f472b6", // pink
  "#fbbf24", // amber
  "#f87171", // red
  "#2dd4bf", // teal
  "#fb923c", // orange
  "#818cf8", // indigo
  "#c084fc", // violet
];

export function normalizeWorld(w: WorldMeta): WorldMeta {
  const system = normalizeWorldSystem((w as { system?: unknown }).system);
  const rawPresets = (w as { spellPresets?: unknown }).spellPresets;
  return {
    ...w,
    system,
    dmRoster: Array.isArray(w.dmRoster)
      ? w.dmRoster.filter((id) => typeof id === "string")
      : [],
    spellPresets:
      system === "dnd5e"
        ? mergeCoreSpellPresets(Array.isArray(rawPresets) ? (rawPresets as DndSpellPreset[]) : [])
        : Array.isArray(rawPresets)
          ? (rawPresets as DndSpellPreset[])
          : [],
  };
}

export function loadWorlds(): WorldMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORLDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorldMeta[];
    const worlds = parsed.map(normalizeWorld);
    const grew = worlds.some((w, i) => {
      const prev = parsed[i]?.spellPresets;
      const before = Array.isArray(prev) ? prev.length : 0;
      return (w.spellPresets?.length || 0) > before;
    });
    if (grew) {
      localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
    }
    return worlds;
  } catch {
    return [];
  }
}

export function saveWorlds(worlds: WorldMeta[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  } catch (e) {
    console.warn("Failed to save worlds", e);
  }
}

export function createWorldId() {
  return crypto.randomUUID();
}

/** Ensure worlds exist for any character.world strings not yet registered */
export function migrateWorldsFromCharacters(
  existing: WorldMeta[],
  worldNames: string[]
): WorldMeta[] {
  const byName = new Map(existing.map((w) => [w.name, w]));
  const now = new Date().toISOString();
  let colorIdx = existing.length;
  const result = existing.map(normalizeWorld);
  for (const name of worldNames) {
    const n = name.trim();
    if (!n || byName.has(n)) continue;
    const color = WORLD_COLOR_PALETTE[colorIdx % WORLD_COLOR_PALETTE.length];
    colorIdx++;
    const w: WorldMeta = {
      id: createWorldId(),
      name: n,
      color,
      system: "generic",
      dmRoster: [],
      spellPresets: [],
      createdAt: now,
      updatedAt: now,
    };
    result.push(w);
    byName.set(n, w);
  }
  return result;
}
