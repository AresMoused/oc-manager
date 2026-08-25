/** Deterministic OC prompt rolls for /灵感 and /每日. */

import {
  getDefaultEnabledIds,
  getLexiconIndex,
  getLexiconList,
  type LexiconItem,
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
};

let cache: { at: number; fixed: string; sections: LoadedSection[] } | null =
  null;

export async function loadEnabledLexicon(force = false): Promise<{
  fixed: string;
  sections: LoadedSection[];
  enabledListIds: string[];
}> {
  const enabledListIds = await getDefaultEnabledIds();
  if (!force && cache && Date.now() - cache.at < 60_000) {
    return { ...cache, enabledListIds };
  }
  const index = await getLexiconIndex();
  const sections: LoadedSection[] = [];
  const lists = await Promise.all(enabledListIds.map((id) => getLexiconList(id)));
  for (let i = 0; i < enabledListIds.length; i++) {
    const content = lists[i];
    if (!content?.items?.length) continue;
    sections.push({
      id: content.id || enabledListIds[i]!,
      label: content.label || enabledListIds[i]!,
      items: content.items,
    });
  }
  const fixed = index.fixed || "1girl, ";
  cache = { at: Date.now(), fixed, sections };
  return { fixed, sections, enabledListIds };
}

export async function rollInspire(code?: string): Promise<InspireRoll> {
  const used = code ? normalizeCode(code) : newInspireCode();
  const { fixed, sections, enabledListIds } = await loadEnabledLexicon();
  const rng = mulberry32(await seedFromCode(used));
  const picks: InspireSectionPick[] = [];
  let prompt = fixed;
  for (const sec of sections) {
    if (!sec.items.length) continue;
    const idx = Math.floor(rng() * sec.items.length);
    const item = sec.items[idx]!;
    picks.push({
      id: sec.id,
      label: sec.label,
      name: item.name,
      tags: item.tags || "",
    });
    prompt += item.tags || "";
  }
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
