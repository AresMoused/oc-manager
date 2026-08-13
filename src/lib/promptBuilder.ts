/** Character appearance prompt builder data + GitHub sync */

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
  base?: string;
  fixed?: string;
  sections: BuilderSection[];
}

const CACHE_KEY = "oc-builder-data-v1";
const SYNC_URL_KEY = "oc-builder-sync-url";

/** Default GitHub raw URL for prompt catalog (JSON) */
export const DEFAULT_SYNC_URL =
  "https://raw.githubusercontent.com/AresMoused/oc-manager/main/public/prompts/original_character.json";

export function getSyncUrl(): string {
  if (typeof window === "undefined") return DEFAULT_SYNC_URL;
  return localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL;
}

export function setSyncUrl(url: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_URL_KEY, url.trim());
}

export function loadCachedBuilder(): BuilderData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BuilderData;
    if (!data?.sections?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCachedBuilder(data: BuilderData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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

export async function syncBuilderFromGitHub(
  url?: string
): Promise<{ data: BuilderData; source: string }> {
  const target = (url || getSyncUrl()).trim();
  if (!target) throw new Error("No sync URL configured");

  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "无法解析文件。请使用 JSON 格式（与 public/prompts/original_character.json 相同结构）。"
    );
  }

  const data = normalizeBuilderData(parsed);
  saveCachedBuilder(data);
  if (url) setSyncUrl(url);
  return { data, source: target };
}

export function composePrompt(
  data: BuilderData,
  selected: Record<string, number>
): string {
  let out = (data.base || "") + (data.fixed || "");
  for (const s of data.sections) {
    const idx = selected[s.key];
    if (idx != null && idx >= 0 && s.items[idx]) {
      out += s.items[idx].tags || "";
    }
  }
  return out;
}
