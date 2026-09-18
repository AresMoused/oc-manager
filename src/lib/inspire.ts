/** Deterministic OC prompt rolls for /灵感 and /每日. */

import {
  getDefaultEnabledIds,
  getLexiconIndex,
  getLexiconList,
  getMergeState,
  type LexiconItem,
  type LexiconMergeState,
} from "@/lib/lexiconServer";

export type InspireSectionPick = {
  id: string;
  label: string;
  name: string;
  tags: string;
};

export type InspireRoll = {
  code: string;
  fixed: string;
  prompt: string;
  picks: InspireSectionPick[];
  enabledListIds: string[];
};

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newInspireCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "OC-";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export function extractInspireCode(text: string): string | null {
  const m = String(text || "").match(/#?(OC-[0-9A-HJ-NP-TV-Z]{6})/i);
  return m ? m[1]!.toUpperCase().replace("OC-", "OC-") : null;
}

function normalizeCode(code: string): string {
  const m = code.toUpperCase().match(/OC-[0-9A-HJ-NP-TV-Z]{6}/);
  return m ? m[0] : code.toUpperCase();
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedFromCode(code: string): Promise<number> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("oc-inspire:" + normalizeCode(code))
  );
  return new DataView(buf).getUint32(0);
}

type LoadedSection = {
  id: string;
  label: string;
  items: LexiconItem[];
  categoryId?: string;
};

let cache: {
  at: number;
  fixed: string;
  sections: LoadedSection[];
  enabledKey: string;
} | null = null;

export function invalidateInspireCache() {
  cache = null;
}

export async function loadEnabledLexicon(force = false): Promise<{
  fixed: string;
  sections: LoadedSection[];
  enabledListIds: string[];
}> {
  const enabledListIds = await getDefaultEnabledIds();
  const enabledKey = enabledListIds.join("\0");
  if (!force && cache && Date.now() - cache.at < 60_000 && cache.enabledKey === enabledKey) {
    return { fixed: cache.fixed, sections: cache.sections, enabledListIds };
  }
  const index = await getLexiconIndex();
  const catByList: Record<string, string> = {};
  for (const c of index.categories) {
    for (const l of c.lists) catByList[l.id] = c.id;
  }
  const sections: LoadedSection[] = [];
  const lists = await Promise.all(enabledListIds.map((id) => getLexiconList(id)));
  for (let i = 0; i < enabledListIds.length; i++) {
    const content = lists[i];
    if (!content?.items?.length) continue;
    const id = content.id || enabledListIds[i]!;
    sections.push({
      id,
      label: content.label || id,
      items: content.items,
      categoryId: catByList[id],
    });
  }
  const fixed = index.fixed || "1girl, ";
  cache = { at: Date.now(), fixed, sections, enabledKey };
  return { fixed, sections, enabledListIds };
}

function clampMergeWeight(n: number): number {
  const v = Math.round(Number(n) || 1);
  return Math.min(5, Math.max(1, v));
}

function pickWeightedId(
  ids: string[],
  weights: Record<string, number>,
  rng: () => number
): string {
  const bag = ids.map((id) => ({ id, w: clampMergeWeight(weights[id] ?? 1) }));
  const total = bag.reduce((s, x) => s + x.w, 0) || bag.length;
  let r = rng() * total;
  for (const x of bag) {
    r -= x.w;
    if (r < 0) return x.id;
  }
  return bag[bag.length - 1]!.id;
}

function rollSections(
  sections: LoadedSection[],
  merge: LexiconMergeState,
  rng: () => number
): InspireSectionPick[] {
  const byCat = new Map<string, LoadedSection[]>();
  for (const s of sections) {
    if (!s.categoryId) continue;
    const arr = byCat.get(s.categoryId) || [];
    arr.push(s);
    byCat.set(s.categoryId, arr);
  }
  const winnerByCat = new Map<string, string>();
  for (const [cat, members] of byCat) {
    if (!merge[cat]?.on || members.length < 2) continue;
    winnerByCat.set(
      cat,
      pickWeightedId(
        members.map((s) => s.id),
        merge[cat]?.weights || {},
        rng
      )
    );
  }
  const picks: InspireSectionPick[] = [];
  const seenCat = new Set<string>();
  for (const sec of sections) {
    const cat = sec.categoryId;
    if (cat && winnerByCat.has(cat)) {
      if (seenCat.has(cat)) continue;
      seenCat.add(cat);
      const winId = winnerByCat.get(cat);
      const winner = sections.find((s) => s.id === winId) || sec;
      if (!winner.items.length) continue;
      const item = winner.items[Math.floor(rng() * winner.items.length)]!;
      picks.push({
        id: winner.id,
        label: winner.label,
        name: item.name,
        tags: item.tags || "",
      });
      continue;
    }
    if (!sec.items.length) continue;
    const item = sec.items[Math.floor(rng() * sec.items.length)]!;
    picks.push({
      id: sec.id,
      label: sec.label,
      name: item.name,
      tags: item.tags || "",
    });
  }
  return picks;
}

export async function rollInspire(code?: string): Promise<InspireRoll> {
  const used = code ? normalizeCode(code) : newInspireCode();
  const { fixed, sections, enabledListIds } = await loadEnabledLexicon();
  const merge = await getMergeState();
  const rng = mulberry32(await seedFromCode(used));
  const picks = rollSections(sections, merge, rng);
  let prompt = fixed;
  for (const p of picks) prompt += p.tags || "";
  return { code: used, fixed, prompt: prompt.trim(), picks, enabledListIds };
}

export function inspireSummary(roll: InspireRoll, limit = 12): string {
  const lines = roll.picks.slice(0, limit).map((p) => `**${p.label}**  ${p.name}`);
  if (roll.picks.length > limit) lines.push(`…共 ${roll.picks.length} 项`);
  return lines.join("\n");
}

export function hktDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function hktYesterday(dateStr: string): string {
  const dt = new Date(`${dateStr}T12:00:00+08:00`);
  dt.setDate(dt.getDate() - 1);
  return hktDate(dt);
}
