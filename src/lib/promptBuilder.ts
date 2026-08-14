/** Character appearance prompt builder data + multi-preset + GitHub sync */

export interface BuilderItem {
  name: string;
  tags: string;
  hex?: string;
}

export interface BuilderSection {
  key: string;
  label: string;
  icon?: string;
  desc?: string;
  items: BuilderItem[];
}

export interface BuilderData {
  id: string;
  name?: string;
  base?: string;
  fixed?: string;
  sections: BuilderSection[];
}

export interface StoredBuilderPreset {
  id: string;
  name: string;
  syncUrl?: string;
  data: BuilderData;
  updatedAt: string;
}

export interface BuiltinCatalog {
  id: string;
  name: string;
  file: string;
  description?: string;
}

const LEGACY_CACHE_KEY = "oc-builder-data-v1";
const PRESETS_KEY = "oc-builder-presets-v1";
const ACTIVE_PRESET_KEY = "oc-builder-active-preset-v1";
const SYNC_URL_KEY = "oc-builder-sync-url";

export const DEFAULT_SYNC_URL =
  "https://raw.githubusercontent.com/AresMoused/oc-manager/main/public/prompts/original_character.json";

export const BUILTIN_CATALOGS: BuiltinCatalog[] = [
  {
    id: "original_character",
    name: "通用原创角色",
    file: "/prompts/original_character.json",
    description: "默认外观词库",
  },
];

export function getSyncUrl(): string {
  if (typeof window === "undefined") return DEFAULT_SYNC_URL;
  return localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL;
}

export function setSyncUrl(url: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_URL_KEY, url.trim());
}

function newId() {
  return crypto.randomUUID();
}

export function normalizeBuilderData(raw: unknown): BuilderData {
  if (!raw || typeof raw !== "object") throw new Error("Invalid builder data");
  const o = raw as Record<string, unknown>;
  const sections = (o.sections as BuilderSection[]) || [];
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error("No sections in builder data");
  }
  return {
    id: String(o.id || "builder"),
    name: o.name ? String(o.name) : undefined,
    base: String(o.base || ""),
    fixed: String(o.fixed || ""),
    sections: sections.map((s) => ({
      key: String(s.key),
      label: String(s.label || s.key),
      icon: s.icon,
      desc: s.desc,
      items: (s.items || []).map((it) => ({
        name: String(it.name || ""),
        tags: String(it.tags || ""),
        hex: it.hex ? String(it.hex) : undefined,
      })),
    })),
  };
}

function migrateLegacyIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(PRESETS_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
    if (!legacy) return;
    const data = normalizeBuilderData(JSON.parse(legacy));
    const preset: StoredBuilderPreset = {
      id: data.id || "legacy",
      name: data.name || "默认词库",
      syncUrl: getSyncUrl(),
      data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PRESETS_KEY, JSON.stringify([preset]));
    localStorage.setItem(ACTIVE_PRESET_KEY, preset.id);
  } catch {
    /* ignore */
  }
}

export function listBuilderPresets(): StoredBuilderPreset[] {
  if (typeof window === "undefined") return [];
  migrateLegacyIfNeeded();
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredBuilderPreset[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePresetsList(list: StoredBuilderPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

export function getActivePresetId(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyIfNeeded();
  return localStorage.getItem(ACTIVE_PRESET_KEY);
}

export function setActivePresetId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

export function getActivePreset(): StoredBuilderPreset | null {
  const id = getActivePresetId();
  const list = listBuilderPresets();
  if (id) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  return list[0] || null;
}

export function loadCachedBuilder(): BuilderData | null {
  const active = getActivePreset();
  if (active) return active.data;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return null;
    return normalizeBuilderData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveCachedBuilder(data: BuilderData) {
  if (typeof window === "undefined") return;
  const list = listBuilderPresets();
  const activeId = getActivePresetId();
  const idx = list.findIndex((p) => p.id === activeId);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      data,
      name: data.name || list[idx].name,
      updatedAt: new Date().toISOString(),
    };
    savePresetsList(list);
  } else {
    const preset: StoredBuilderPreset = {
      id: data.id || newId(),
      name: data.name || "默认词库",
      syncUrl: getSyncUrl(),
      data,
      updatedAt: new Date().toISOString(),
    };
    savePresetsList([...list, preset]);
    setActivePresetId(preset.id);
  }
  localStorage.setItem(LEGACY_CACHE_KEY, JSON.stringify(data));
}

export function upsertBuilderPreset(
  preset: Omit<StoredBuilderPreset, "updatedAt"> & { updatedAt?: string }
): StoredBuilderPreset {
  const list = listBuilderPresets();
  const full: StoredBuilderPreset = {
    ...preset,
    updatedAt: preset.updatedAt || new Date().toISOString(),
  };
  const idx = list.findIndex((p) => p.id === full.id);
  if (idx >= 0) list[idx] = full;
  else list.push(full);
  savePresetsList(list);
  return full;
}

export function deleteBuilderPreset(id: string) {
  const list = listBuilderPresets().filter((p) => p.id !== id);
  savePresetsList(list);
  if (getActivePresetId() === id) {
    if (list[0]) setActivePresetId(list[0].id);
    else localStorage.removeItem(ACTIVE_PRESET_KEY);
  }
}

export function createPresetFromData(
  name: string,
  data: BuilderData,
  syncUrl?: string
): StoredBuilderPreset {
  const preset: StoredBuilderPreset = {
    id: newId(),
    name: name.trim() || data.name || data.id || "未命名预设",
    syncUrl,
    data: { ...data, name: name.trim() || data.name },
    updatedAt: new Date().toISOString(),
  };
  upsertBuilderPreset(preset);
  setActivePresetId(preset.id);
  saveCachedBuilder(preset.data);
  return preset;
}

export async function loadBuiltinCatalog(catalog: BuiltinCatalog): Promise<StoredBuilderPreset> {
  const res = await fetch(catalog.file, { cache: "no-store" });
  if (!res.ok) throw new Error(`无法加载 ${catalog.file}`);
  const data = normalizeBuilderData(await res.json());
  data.name = catalog.name;
  return createPresetFromData(catalog.name, data, undefined);
}

export async function loadPresetFromUrl(url: string, name?: string): Promise<StoredBuilderPreset> {
  const res = await fetch(url.trim(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("无法解析为 JSON，请使用与 original_character.json 相同结构的文件");
  }
  const data = normalizeBuilderData(parsed);
  return createPresetFromData(name || data.name || data.id || "远程词库", data, url.trim());
}

export async function loadPresetFromFile(file: File, name?: string): Promise<StoredBuilderPreset> {
  const text = await file.text();
  const data = normalizeBuilderData(JSON.parse(text));
  return createPresetFromData(
    name || data.name || file.name.replace(/\.json$/i, "") || "导入词库",
    data
  );
}

export async function syncBuilderFromGitHub(
  url?: string
): Promise<{ data: BuilderData; source: string }> {
  const active = getActivePreset();
  const target = (url || active?.syncUrl || getSyncUrl()).trim();
  if (!target) throw new Error("No sync URL configured");
  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("无法解析文件。请使用 JSON 格式（与 original_character.json 相同结构）。");
  }
  const data = normalizeBuilderData(parsed);
  if (active) {
    upsertBuilderPreset({ ...active, data: { ...data, name: active.name }, syncUrl: target });
    setActivePresetId(active.id);
  }
  saveCachedBuilder({ ...data, name: active?.name || data.name });
  if (url) setSyncUrl(url);
  return { data: { ...data, name: active?.name || data.name }, source: target };
}

export function composePrompt(data: BuilderData, selected: Record<string, number>): string {
  let out = (data.base || "") + (data.fixed || "");
  for (const s of data.sections) {
    const idx = selected[s.key];
    if (idx != null && idx >= 0 && s.items[idx]) out += s.items[idx].tags || "";
  }
  return out;
}

export function pickRandomSelected(
  data: BuilderData,
  locked?: Record<string, boolean>,
  prev?: Record<string, number>
): Record<string, number> {
  const sel: Record<string, number> = { ...(prev || {}) };
  for (const s of data.sections) {
    if (locked?.[s.key]) continue;
    if (s.items.length > 0) sel[s.key] = Math.floor(Math.random() * s.items.length);
  }
  return sel;
}
