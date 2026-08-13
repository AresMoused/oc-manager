/** World metadata — top-level partition for all data */

export interface WorldMeta {
  id: string;
  name: string;
  /** Accent color for this world (hex) */
  color: string;
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

export function loadWorlds(): WorldMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORLDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorldMeta[];
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
  const result = [...existing];
  for (const name of worldNames) {
    const n = name.trim();
    if (!n || byName.has(n)) continue;
    const color = WORLD_COLOR_PALETTE[colorIdx % WORLD_COLOR_PALETTE.length];
    colorIdx++;
    const w: WorldMeta = {
      id: createWorldId(),
      name: n,
      color,
      createdAt: now,
      updatedAt: now,
    };
    result.push(w);
    byName.set(n, w);
  }
  return result;
}
