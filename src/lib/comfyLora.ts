/** Browser-side Lora Manager library (same ComfyUI host as the workflow). */

const SELECTED_KEY = "oc-comfy-loras-v1";

export interface LoraLibraryItem {
  modelName: string;
  fileName: string;
  folder: string;
  previewUrl: string;
  baseModel: string;
}

export interface LoraTrigger {
  text: string;
  active: boolean;
}

export interface SelectedLora {
  modelName: string;
  fileName: string;
  folder: string;
  strength: number;
  clipStrength: number;
  active: boolean;
  triggers: LoraTrigger[];
}

export interface LoraLibraryPage {
  items: LoraLibraryItem[];
  total: number;
  page: number;
}

function rootOf(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function absUrl(baseUrl: string, url: string): string {
  if (!url) return "";
  if (/^https?:/i.test(url)) return url;
  return `${rootOf(baseUrl)}${url.startsWith("/") ? "" : "/"}${url}`;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function loraKey(lora: { folder?: string; fileName: string }): string {
  return `${lora.folder || ""}/${lora.fileName}`;
}

/** Name the loader resolves: folder/file without extension, else the file stem. */
export function loraWidgetName(lora: { folder?: string; fileName: string }): string {
  const stem = lora.fileName.replace(/\.(safetensors|ckpt|pt|bin)$/i, "");
  const folder = (lora.folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${stem}` : stem;
}

export function loadSelectedLoras(): SelectedLora[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        const r = asRecord(row);
        if (!r || typeof r.fileName !== "string" || !r.fileName) return null;
        const triggers = Array.isArray(r.triggers)
          ? r.triggers
              .map((t) => {
                const x = asRecord(t);
                const text = x && typeof x.text === "string" ? x.text.trim() : "";
                if (!text) return null;
                return { text, active: x?.active !== false };
              })
              .filter((t): t is LoraTrigger => !!t)
          : [];
        return {
          modelName: typeof r.modelName === "string" && r.modelName ? r.modelName : r.fileName,
          fileName: r.fileName,
          folder: typeof r.folder === "string" ? r.folder : "",
          strength: num(r.strength, 0.6),
          clipStrength: num(r.clipStrength, num(r.strength, 0.6)),
          active: r.active !== false,
          triggers,
        } satisfies SelectedLora;
      })
      .filter((x): x is SelectedLora => !!x);
  } catch {
    return [];
  }
}

export function saveSelectedLoras(list: SelectedLora[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_KEY, JSON.stringify(list));
}

export async function fetchLoraLibrary(
  baseUrl: string,
  search: string,
  page = 1
): Promise<LoraLibraryPage> {
  const q = new URLSearchParams({
    page: String(page),
    page_size: "40",
    sort_by: "name",
    search: search.trim(),
  });
  const res = await fetch(`${rootOf(baseUrl)}/api/lm/loras/list?${q}`);
  if (!res.ok) {
    throw new Error(`Lora Manager 列表失败 ${res.status}。地址用 ComfyUI 根地址，不是 /loras 页面。`);
  }
  const data = (await res.json()) as unknown;
  const body = asRecord(data) || {};
  const rawItems = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.loras)
      ? body.loras
      : [];
  const items: LoraLibraryItem[] = [];
  for (const row of rawItems) {
    const r = asRecord(row);
    if (!r) continue;
    const fileName = typeof r.file_name === "string" ? r.file_name : "";
    if (!fileName) continue;
    const modelName = typeof r.model_name === "string" && r.model_name ? r.model_name : fileName;
    items.push({
      modelName,
      fileName,
      folder: typeof r.folder === "string" ? r.folder : "",
      previewUrl: absUrl(baseUrl, typeof r.preview_url === "string" ? r.preview_url : ""),
      baseModel: typeof r.base_model === "string" ? r.base_model : "",
    });
  }
  return {
    items,
    total: num(body.total, items.length),
    page: num(body.page, page),
  };
}

/** Latest trigger words from the server cache (civitai.trainedWords). */
export async function fetchLoraTriggerWords(baseUrl: string, fileName: string): Promise<string[]> {
  const q = new URLSearchParams({ name: fileName });
  const res = await fetch(`${rootOf(baseUrl)}/api/lm/loras/get-trigger-words?${q}`);
  if (!res.ok) throw new Error(`读取触发词失败 ${res.status}`);
  const data = (await res.json()) as { trigger_words?: unknown; success?: boolean };
  const words = Array.isArray(data.trigger_words) ? data.trigger_words : [];
  return words.map((w) => String(w).trim()).filter(Boolean);
}

export function mergeTriggerWords(prev: LoraTrigger[], words: string[]): LoraTrigger[] {
  const old = new Map(prev.map((t) => [t.text, t.active]));
  return words.map((text) => ({ text, active: old.has(text) ? !!old.get(text) : true }));
}

function trimNum(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

type GraphNode = { class_type?: string; inputs?: Record<string, unknown> };

function asNode(v: unknown): GraphNode | null {
  if (!v || typeof v !== "object" || !("class_type" in v)) return null;
  return v as GraphNode;
}

/**
 * Write the 抽卡姬 selection into Lora Loader + TriggerWord Toggle.
 * Empty selection leaves the workflow untouched.
 * orinalMessage must match the loader's full trigger string or the toggle node skips every switch.
 */
export function patchWorkflowLoras(
  graph: Record<string, unknown>,
  selected: SelectedLora[]
): { loaders: number; toggles: number } {
  if (!selected.length) return { loaders: 0, toggles: 0 };
  const active = selected.filter((s) => s.active);
  const widget = active.map((lora) => ({
    name: loraWidgetName(lora),
    strength: lora.strength,
    active: true,
    expanded: false,
    clipStrength: lora.clipStrength,
    selected: false,
    locked: false,
  }));
  const syntax = widget
    .map((l) =>
      Math.abs(l.strength - l.clipStrength) < 0.001
        ? `<lora:${l.name}:${trimNum(l.strength)}>`
        : `<lora:${l.name}:${trimNum(l.strength)}:${trimNum(l.clipStrength)}>`
    )
    .join(" ");
  const words = active.flatMap((lora) => lora.triggers.filter((t) => t.text.trim()));
  const original = words.map((w) => w.text).join(",, ");
  const toggleValue = words.map((w) => ({
    text: w.text,
    active: w.active,
    highlighted: false,
    strength: null,
    items: [{ text: w.text, active: w.active, highlighted: false, strength: null }],
  }));

  let loaders = 0;
  let toggles = 0;
  for (const value of Object.values(graph)) {
    const node = asNode(value);
    if (!node?.inputs) continue;
    if (node.class_type === "Lora Loader (LoraManager)") {
      node.inputs.loras = { __value__: widget };
      node.inputs.text = syntax;
      loaders += 1;
    } else if (node.class_type === "TriggerWord Toggle (LoraManager)") {
      node.inputs.toggle_trigger_words = { __value__: toggleValue };
      node.inputs.orinalMessage = original;
      toggles += 1;
    }
  }
  if (!loaders) {
    throw new Error("工作流里没有 Lora Loader (LoraManager)，抽卡姬的 LoRA 选择加不进去。");
  }
  return { loaders, toggles };
}
