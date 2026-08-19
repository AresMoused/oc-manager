/**
 * Client lexicon: CDN catalog + local private lists + enable state + config presets.
 * Old whole-package presets (oc-builder-presets-v1) are abandoned.
 */
import type { BuilderData, BuilderItem, BuilderSection } from "@/lib/promptBuilder";

export interface LexiconItem {
  name: string;
  tags: string;
  hex?: string;
  image?: string;
}

export interface LexiconListMeta {
  id: string;
  label: string;
  path: string;
  icon?: string;
  desc?: string;
}

export interface LexiconCategory {
  id: string;
  label: string;
  lists: LexiconListMeta[];
}

export interface LexiconIndex {
  version: number;
  fixed?: string;
  categories: LexiconCategory[];
}

export interface LexiconListContent {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  items: LexiconItem[];
  local?: boolean;
}

export interface LocalLexiconList extends LexiconListContent {
  categoryId: string;
  categoryLabel: string;
  local: true;
  createdAt: string;
}

/** Config-only preset (no full word package) */
export interface LexiconPreset {
  id: string;
  name: string;
  enabledListIds: string[];
  selected?: Record<string, number>;
  locked?: Record<string, boolean>;
  fixed?: string;
  updatedAt: string;
}

const ENABLED_KEY = "oc-lexicon-enabled-v2";
const LOCAL_LISTS_KEY = "oc-lexicon-local-v2";
const PRESETS_KEY = "oc-lexicon-presets-v2";
const ACTIVE_PRESET_KEY = "oc-lexicon-active-preset-v2";
const SELECTED_KEY = "oc-lexicon-selected-v2";
const LOCKED_KEY = "oc-lexicon-locked-v2";
const FIXED_KEY = "oc-lexicon-fixed-v2";
const CONTENT_CACHE_KEY = "oc-lexicon-content-cache-v2";

/** Wipe legacy whole-package preset keys once */
export function abandonLegacyPresets() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("oc-builder-presets-v1");
    localStorage.removeItem("oc-builder-active-preset-v1");
    localStorage.removeItem("oc-builder-data-v1");
    localStorage.removeItem("oc-builder-sync-url");
  } catch {
    /* ignore */
  }
}

export function loadLocalLists(): LocalLexiconList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_LISTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveLocalLists(lists: LocalLexiconList[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
}

export function upsertLocalList(list: LocalLexiconList) {
  const all = loadLocalLists().filter((x) => x.id !== list.id);
  all.unshift(list);
  saveLocalLists(all);
}

export function deleteLocalList(id: string) {
  saveLocalLists(loadLocalLists().filter((x) => x.id !== id));
}

export function loadEnabledMap(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return null;
  }
}

export function saveEnabledMap(map: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_KEY, JSON.stringify(map));
}

export function setListEnabled(id: string, on: boolean) {
  const map = loadEnabledMap() || {};
  map[id] = on;
  saveEnabledMap(map);
}

export function resolveEnabledIds(
  allIds: string[],
  defaultIds: string[]
): string[] {
  const saved = loadEnabledMap();
  if (!saved) {
    return allIds.filter((id) => defaultIds.includes(id));
  }
  return allIds.filter((id) => saved[id] === true);
}

export function loadSelected(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SELECTED_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSelected(sel: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_KEY, JSON.stringify(sel));
}

export function loadLocked(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LOCKED_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveLocked(locked: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCKED_KEY, JSON.stringify(locked));
}

export function loadFixed(fallback = "1girl, "): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(FIXED_KEY) ?? fallback;
}

export function saveFixed(fixed: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIXED_KEY, fixed);
}

function contentCacheGet(): Record<string, LexiconListContent> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CONTENT_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function contentCacheSet(id: string, content: LexiconListContent) {
  if (typeof window === "undefined") return;
  const c = contentCacheGet();
  c[id] = content;
  try {
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

export async function fetchLexiconCatalog(): Promise<{
  index: LexiconIndex;
  defaultEnabled: string[];
}> {
  const res = await fetch("/api/lexicon", { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载词库目录");
  const data = await res.json();
  return {
    index: data.index as LexiconIndex,
    defaultEnabled: (data.defaultEnabled as string[]) || [],
  };
}

export async function fetchLexiconList(
  listId: string
): Promise<LexiconListContent | null> {
  const local = loadLocalLists().find((x) => x.id === listId);
  if (local) return local;

  const cached = contentCacheGet()[listId];
  if (cached?.items?.length) return cached;

  const res = await fetch(
    `/api/lexicon/list?id=${encodeURIComponent(listId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as LexiconListContent;
  if (data?.items) contentCacheSet(listId, data);
  return data;
}

export async function loadEnabledSections(
  enabledIds: string[]
): Promise<BuilderSection[]> {
  const sections: BuilderSection[] = [];
  for (const id of enabledIds) {
    const content = await fetchLexiconList(id);
    if (!content || !content.items?.length) continue;
    sections.push({
      key: content.id,
      label: content.label,
      icon: content.icon,
      desc: content.desc,
      items: content.items.map(
        (it): BuilderItem => ({
          name: it.name,
          tags: it.tags,
          hex: it.hex,
          image: it.image,
        })
      ),
    });
  }
  return sections;
}

export async function buildEnabledBuilderData(
  enabledIds: string[],
  fixed: string
): Promise<BuilderData> {
  const sections = await loadEnabledSections(enabledIds);
  return {
    id: "lexicon-runtime",
    name: "CDN 词库",
    fixed,
    sections,
  };
}

export function listLexiconPresets(): LexiconPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePresets(list: LexiconPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

export function getActiveLexiconPresetId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PRESET_KEY);
}

export function setActiveLexiconPresetId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

export function saveLexiconPreset(
  name: string,
  enabledListIds: string[],
  opts?: {
    selected?: Record<string, number>;
    locked?: Record<string, boolean>;
    fixed?: string;
    id?: string;
  }
): LexiconPreset {
  const list = listLexiconPresets();
  const preset: LexiconPreset = {
    id: opts?.id || crypto.randomUUID(),
    name: name.trim() || "未命名预设",
    enabledListIds: [...enabledListIds],
    selected: opts?.selected,
    locked: opts?.locked,
    fixed: opts?.fixed,
    updatedAt: new Date().toISOString(),
  };
  const idx = list.findIndex((p) => p.id === preset.id);
  if (idx >= 0) list[idx] = preset;
  else list.unshift(preset);
  savePresets(list);
  setActiveLexiconPresetId(preset.id);
  return preset;
}

export function deleteLexiconPreset(id: string) {
  const list = listLexiconPresets().filter((p) => p.id !== id);
  savePresets(list);
  if (getActiveLexiconPresetId() === id) {
    localStorage.removeItem(ACTIVE_PRESET_KEY);
  }
}

export function applyLexiconPreset(preset: LexiconPreset) {
  const map: Record<string, boolean> = {};
  for (const id of preset.enabledListIds) map[id] = true;
  saveEnabledMap(map);
  if (preset.selected) saveSelected(preset.selected);
  if (preset.locked) saveLocked(preset.locked);
  if (preset.fixed != null) saveFixed(preset.fixed);
  setActiveLexiconPresetId(preset.id);
}

export function pickRandomSelected(
  sections: BuilderSection[],
  locked?: Record<string, boolean>,
  prev?: Record<string, number>
): Record<string, number> {
  const sel: Record<string, number> = { ...(prev || {}) };
  for (const s of sections) {
    if (locked?.[s.key]) continue;
    if (s.items.length > 0) {
      sel[s.key] = Math.floor(Math.random() * s.items.length);
    }
  }
  return sel;
}

export function composeFromSections(
  fixed: string,
  sections: BuilderSection[],
  selected: Record<string, number>
): string {
  let out = fixed || "";
  for (const s of sections) {
    const idx = selected[s.key];
    if (idx != null && idx >= 0 && s.items[idx]) {
      out += s.items[idx].tags || "";
    }
  }
  return out;
}
