/** ComfyUI connection, workflow templates, and generation params (browser local) */

import { pushDebugLog } from "@/lib/debugLog";
import { loadSelectedLoras, patchWorkflowLoras } from "@/lib/comfyLora";
import { KREA_DEFAULT_ID, KREA_DEFAULT_WORKFLOW } from "@/lib/kreaDefaultWorkflow";

export interface ComfyWorkflowTemplate {
  id: string;
  name: string;
  workflow: string;
  createdAt: string;
  updatedAt: string;
  /** Shipped with the app. Sampling, scheduler and VAE stay as authored. */
  builtin?: boolean;
}

export interface ComfyParams {
  seed: number;
  steps: number;
  cfg_scale: number;
  sampler_name: string;
  width: number;
  height: number;
  prompt: string;
  prompt_prefix: string;
  prompt_character: string;
  prompt_suffix: string;
  negative_prompt: string;
  MODEL_NAME: string;
  scheduler: string;
  vae: string;
}

export interface ComfyPromptPreset {
  id: string;
  name: string;
  prompt_prefix: string;
  prompt_character: string;
  prompt_suffix: string;
  negative_prompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComfySettings {
  baseUrl: string;
  activeWorkflowId: string;
}

const SETTINGS_KEY = "oc-comfy-settings-v1";
const WORKFLOWS_KEY = "oc-comfy-workflows-v1";
const PARAMS_KEY = "oc-comfy-params-v1";
const PRESETS_KEY = "oc-comfy-prompt-presets-v1";

export const PLACEHOLDERS = [
  "seed", "steps", "cfg_scale", "sampler_name", "width", "height",
  "prompt", "negative_prompt", "MODEL_NAME", "scheduler", "vae",
  "prompt_prefix", "prompt_character", "prompt_suffix",
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number];

export const DEFAULT_SAMPLERS = [
  "euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral", "lms",
  "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_sde", "dpmpp_2m",
  "dpmpp_2m_sde", "ddim", "uni_pc",
];

export const DEFAULT_SCHEDULERS = [
  "normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform",
];

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "p512", label: "竖图 512×768", width: 512, height: 768 },
  { id: "p768", label: "竖图 768×1152", width: 768, height: 1152 },
  { id: "p832", label: "SDXL 竖 832×1216", width: 832, height: 1216 },
  { id: "l512", label: "横图 768×512", width: 768, height: 512 },
  { id: "l768", label: "横图 1152×768", width: 1152, height: 768 },
  { id: "l832", label: "SDXL 横 1216×832", width: 1216, height: 832 },
  { id: "s512", label: "方图 512×512", width: 512, height: 512 },
  { id: "s768", label: "方图 768×768", width: 768, height: 768 },
  { id: "s1024", label: "方图 1024×1024", width: 1024, height: 1024 },
];

export function defaultParams(): ComfyParams {
  return {
    seed: -1, steps: 20, cfg_scale: 7, sampler_name: "euler",
    width: 512, height: 768, prompt: "",
    prompt_prefix: "masterpiece, best quality, ",
    prompt_character: "", prompt_suffix: "",
    negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers",
    MODEL_NAME: "", scheduler: "normal", vae: "",
  };
}

export function composePositivePrompt(p: {
  prompt_prefix?: string; prompt_character?: string; prompt_suffix?: string; prompt?: string;
}): string {
  const parts = [(p.prompt_prefix || "").trim(), (p.prompt_character || "").trim(), (p.prompt_suffix || "").trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return (p.prompt || "").trim();
}

export function defaultSettings(): ComfySettings {
  return { baseUrl: "http://127.0.0.1:8964", activeWorkflowId: "" };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadSettings(): ComfySettings {
  if (typeof window === "undefined") return defaultSettings();
  return { ...defaultSettings(), ...safeParse(localStorage.getItem(SETTINGS_KEY), {}) };
}
export function saveSettings(s: ComfySettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
export function loadWorkflows(): ComfyWorkflowTemplate[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(WORKFLOWS_KEY), []);
}
export function saveWorkflows(list: ComfyWorkflowTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(list));
}

/** Install or replace the bundled Krea2 workflow and keep it selected when the old one was active. */
export function ensureDefaultWorkflow(
  list: ComfyWorkflowTemplate[],
  activeId: string
): { list: ComfyWorkflowTemplate[]; activeId: string } {
  const now = new Date().toISOString();
  const removed = list.filter(
    (w) => w.id === KREA_DEFAULT_ID || /^krea2$/i.test(w.name.trim())
  );
  const rest = list.filter((w) => !removed.includes(w));
  const prev = removed.find((w) => w.id === KREA_DEFAULT_ID);
  const tpl: ComfyWorkflowTemplate = {
    id: KREA_DEFAULT_ID,
    name: "Krea2",
    workflow: KREA_DEFAULT_WORKFLOW,
    builtin: true,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  const next = [tpl, ...rest];
  const removedIds = new Set(removed.map((w) => w.id));
  const active = !activeId || removedIds.has(activeId) ? KREA_DEFAULT_ID : activeId;
  return { list: next, activeId: active };
}

/** Point the graph's UNet (or, if it has none, checkpoint) at the model picked in 抽卡姬. */
export function patchSelectedModel(graph: Record<string, unknown>, modelName: string) {
  const name = modelName.trim();
  if (!name) return;
  const nodes = Object.values(graph).filter(
    (node): node is { inputs?: Record<string, unknown> } =>
      !!node && typeof node === "object"
  );
  const unets = nodes.filter((node) => node.inputs && "unet_name" in node.inputs);
  if (unets.length) {
    for (const node of unets) node.inputs!.unet_name = name;
    return;
  }
  for (const node of nodes) {
    if (node.inputs && "ckpt_name" in node.inputs) node.inputs.ckpt_name = name;
  }
}
export function loadParams(): ComfyParams {
  if (typeof window === "undefined") return defaultParams();
  const raw = safeParse<Partial<ComfyParams>>(localStorage.getItem(PARAMS_KEY), {});
  const base = defaultParams();
  const merged = { ...base, ...raw };
  if (raw.prompt && !raw.prompt_character && !raw.prompt_prefix && !raw.prompt_suffix) {
    merged.prompt_character = raw.prompt;
    merged.prompt_prefix = "";
  }
  return merged;
}
export function saveParams(p: ComfyParams) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
}
export function loadPromptPresets(): ComfyPromptPreset[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(PRESETS_KEY), []);
}
export function savePromptPresets(list: ComfyPromptPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

const NUMERIC_PLACEHOLDERS = new Set<PlaceholderKey>([
  "seed", "steps", "cfg_scale", "width", "height",
]);

type WorkflowTokenMask = {
  token: string;
  rawSentinel: string;
  textSentinel: string;
};

/**
 * Temporarily masks template tokens so a workflow can be validated as JSON.
 * Numeric tokens are replaced with JSON strings only during validation and
 * restored before the template is saved; applyPlaceholders resolves them
 * to numbers immediately before the request is sent to ComfyUI.
 */
function maskWorkflowPlaceholders(raw: string): {
  masked: string;
  restore: (serialized: string) => string;
} {
  const masks: WorkflowTokenMask[] = [];
  let masked = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        masked += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        masked += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        masked += ch;
        inString = false;
        continue;
      }

      if (ch === "%") {
        const match = raw.slice(i).match(/^%([A-Za-z0-9_]+)%/);
        if (match && PLACEHOLDERS.includes(match[1] as PlaceholderKey)) {
          const token = match[0];
          const key = match[1] as PlaceholderKey;
          if (NUMERIC_PLACEHOLDERS.has(key)) {
            throw new Error(`${token} 必须作为数字使用，不能加引号`);
          }
          const index = masks.length;
          const mask = {
            token,
            rawSentinel: `__OCM_RAW_TOKEN_${index}__`,
            textSentinel: `__OCM_TEXT_TOKEN_${index}__`,
          };
          masks.push(mask);
          masked += mask.textSentinel;
          i += token.length - 1;
          continue;
        }
      }

      masked += ch;
      continue;
    }

    if (ch === '"') {
      masked += ch;
      inString = true;
      continue;
    }

    if (ch === "%") {
      const match = raw.slice(i).match(/^%([A-Za-z0-9_]+)%/);
      if (match && PLACEHOLDERS.includes(match[1] as PlaceholderKey)) {
        const token = match[0];
        const key = match[1] as PlaceholderKey;
        if (!NUMERIC_PLACEHOLDERS.has(key)) {
          throw new Error(`${token} 必须放在 JSON 字符串引号内`);
        }
        const index = masks.length;
        const mask = {
          token,
          rawSentinel: `__OCM_RAW_TOKEN_${index}__`,
          textSentinel: `__OCM_TEXT_TOKEN_${index}__`,
        };
        masks.push(mask);
        masked += JSON.stringify(mask.rawSentinel);
        i += token.length - 1;
        continue;
      }
    }

    masked += ch;
  }

  const restore = (serialized: string) => {
    let restored = serialized;
    for (const mask of masks) {
      restored = restored
        .split(JSON.stringify(mask.rawSentinel))
        .join(mask.token)
        .split(mask.textSentinel)
        .join(mask.token);
    }
    return restored;
  };

  return { masked, restore };
}

function parseWorkflowTemplate(raw: string): {
  data: Record<string, unknown>;
  restore: (serialized: string) => string;
} {
  const text = raw.trim();
  if (!text) throw new Error("工作流不能为空");

  const unsupported = detectPlaceholders(text).filter(
    (key) => !(PLACEHOLDERS as readonly string[]).includes(key),
  );
  if (unsupported.length > 0) {
    throw new Error(`不支持的占位符：${unsupported.map((key) => `%${key}%`).join(", ")}`);
  }

  const { masked, restore } = maskWorkflowPlaceholders(text);
  const data = JSON.parse(masked) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("工作流必须是 JSON 对象");
  }
  return { data: data as Record<string, unknown>, restore };
}

/** Validate a workflow template without requiring placeholders to be JSON literals. */
export function validateWorkflowTemplate(raw: string): Record<string, unknown> {
  return parseWorkflowTemplate(raw).data;
}

export function applyPlaceholders(workflowRaw: string, params: ComfyParams): Record<string, unknown> {
  const resolvedSeed = params.seed < 0 ? Math.floor(Math.random() * 2 ** 32) : Math.floor(params.seed);
  const fullPrompt = composePositivePrompt(params);
  const map: Record<string, string | number> = {
    seed: resolvedSeed, steps: params.steps, cfg_scale: params.cfg_scale,
    sampler_name: params.sampler_name, width: params.width, height: params.height,
    prompt: fullPrompt, negative_prompt: params.negative_prompt,
    MODEL_NAME: params.MODEL_NAME, scheduler: params.scheduler, vae: params.vae,
    prompt_prefix: params.prompt_prefix, prompt_character: params.prompt_character,
    prompt_suffix: params.prompt_suffix,
  };
  let s = workflowRaw;
  for (const key of PLACEHOLDERS) {
    const token = `%${key}%`;
    const val = map[key];
    if (typeof val === "string") {
      const escaped = JSON.stringify(val).slice(1, -1);
      s = s.split(token).join(escaped);
    } else {
      s = s.split(token).join(String(val));
    }
  }
  const parsed = JSON.parse(s);
  if (typeof parsed !== "object" || parsed === null) throw new Error("工作流必须是 JSON 对象");
  return parsed as Record<string, unknown>;
}

export function detectPlaceholders(workflowRaw: string): string[] {
  const found = new Set<string>();
  const re = /%([A-Za-z0-9_]+)%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(workflowRaw))) found.add(m[1]);
  return Array.from(found).sort();
}

function clientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `oc-${Date.now()}`;
}

export async function comfyQueuePrompt(baseUrl: string, prompt: Record<string, unknown>) {
  const root = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${root}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI /prompt 失败 ${res.status}: ${text}`);
  }
  return res.json();
}

export interface ComfyHistoryImage {
  filename: string;
  subfolder: string;
  type: string;
}

export function imageSaverNodeIds(graph: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const [id, node] of Object.entries(graph)) {
    const ct = (node as { class_type?: string } | null)?.class_type || "";
    if (
      ct === "Image Saver" ||
      ct === "Image Saver Simple" ||
      ct === "Image Saver (From Pipe)"
    ) {
      ids.push(id);
    }
  }
  return ids;
}

function collectHistoryImages(
  outputs: Record<string, { images?: { filename?: string; subfolder?: string; type?: string }[] }>,
  only?: string[]
): ComfyHistoryImage[] {
  const ids = only?.length ? only : Object.keys(outputs);
  const images: ComfyHistoryImage[] = [];
  for (const nodeId of ids) {
    const out = outputs[nodeId];
    if (!out?.images || !Array.isArray(out.images)) continue;
    for (const img of out.images) {
      if (!img?.filename) continue;
      images.push({
        filename: img.filename,
        subfolder: img.subfolder || "",
        type: img.type || "output",
      });
    }
  }
  return images;
}

export async function comfyWaitForImages(
  baseUrl: string, promptId: string,
  opts?: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal; preferNodeIds?: string[] }
): Promise<ComfyHistoryImage[]> {
  const root = baseUrl.replace(/\/+$/, "");
  const timeout = opts?.timeoutMs ?? 600_000;
  const poll = opts?.pollMs ?? 1200;
  const prefer = (opts?.preferNodeIds || []).filter(Boolean);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await fetch(`${root}/history/${promptId}`, { signal: opts?.signal });
    if (res.ok) {
      const data = await res.json();
      const entry = data[promptId];
      const outputs = entry?.outputs as
        | Record<string, { images?: { filename?: string; subfolder?: string; type?: string }[] }>
        | undefined;
      const status = entry?.status?.status_str as string | undefined;
      const done = !!entry?.status?.completed || status === "error" || status === "success";
      if (outputs) {
        if (prefer.length) {
          const saved = collectHistoryImages(outputs, prefer);
          if (saved.length) return saved;
        }
        const all = collectHistoryImages(outputs);
        if (done) {
          if (status === "error" && !all.length) throw new Error("ComfyUI 执行失败，没有图片输出");
          return all;
        }
        if (!prefer.length && all.length) return all;
      } else if (done && status === "error") {
        throw new Error("ComfyUI 执行失败，没有图片输出");
      }
    }
    await new Promise((r) => setTimeout(r, poll));
  }
  throw new Error("等待 ComfyUI 生成超时");
}

export function comfyImageUrl(baseUrl: string, img: ComfyHistoryImage): string {
  const root = baseUrl.replace(/\/+$/, "");
  const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
  return `${root}/view?${q.toString()}`;
}

export async function comfyCheckConnection(baseUrl: string): Promise<string> {
  const root = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${root}/system_stats`);
  if (!res.ok) throw new Error(`连接失败 ${res.status}`);
  const data = await res.json();
  return String(data?.system?.comfyui_version || data?.system?.python_version || "ok");
}

export async function fetchComfyModelLists(baseUrl: string): Promise<{ unet: string[]; checkpoints: string[] }> {
  const root = baseUrl.replace(/\/+$/, "");
  const read = async (folder: string) => {
    const res = await fetch(`${root}/models/${folder}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map((x) => String(x)).filter(Boolean) : [];
  };
  const [unet, checkpoints] = await Promise.all([read("unet"), read("checkpoints")]);
  return { unet, checkpoints };
}

/** Queue the currently saved workflow with optional prompt overrides. */
export async function runSavedComfyJob(
  overrides: Partial<Pick<ComfyParams, "prompt_character" | "prompt_prefix" | "prompt_suffix" | "negative_prompt" | "prompt">> = {},
  signal?: AbortSignal,
  meta?: { source?: string; note?: string }
): Promise<{ urls: string[]; seed: number; prompt: string }> {
  const settings = loadSettings();
  const workflows = loadWorkflows();
  const wf = workflows.find((w) => w.id === settings.activeWorkflowId) || workflows[0];
  if (!wf) throw new Error("抽卡姬还没有工作流。请先到「抽卡姬」页上传并选择一个 ComfyUI 工作流。");
  if (!settings.baseUrl.trim()) throw new Error("抽卡姬未填写 ComfyUI 地址。");
  const params = { ...loadParams(), ...overrides };
  const seedUsed = params.seed < 0 ? Math.floor(Math.random() * 2 ** 32) : Math.floor(params.seed);
  const promptGraph = applyPlaceholders(wf.workflow, { ...params, seed: seedUsed });
  patchSelectedModel(promptGraph, params.MODEL_NAME);
  const loraPatch = patchWorkflowLoras(promptGraph, loadSelectedLoras());
  const { prompt_id } = await comfyQueuePrompt(settings.baseUrl, promptGraph);
  if (!prompt_id) throw new Error("ComfyUI 没有返回 prompt_id");
  const outs = await comfyWaitForImages(settings.baseUrl, String(prompt_id), {
    signal,
    preferNodeIds: imageSaverNodeIds(promptGraph),
  });
  if (!outs.length) throw new Error("ComfyUI 没有输出图片");
  const prompt = composePositivePrompt(params);
  pushDebugLog({
    source: meta?.source || "抽卡姬",
    kind: "comfy",
    title: meta?.note || `seed ${seedUsed}`,
    payload: {
      workflow: wf.name,
      seed: seedUsed,
      prompt,
      negative: params.negative_prompt,
      size: `${params.width}x${params.height}`,
      loraNodes: loraPatch,
      urls: outs.map((img) => comfyImageUrl(settings.baseUrl, img)),
    },
  });
  return {
    urls: outs.map((img) => comfyImageUrl(settings.baseUrl, img)),
    seed: seedUsed,
    prompt,
  };
}

export function normalizeWorkflowUpload(raw: string): string {
  const { data, restore } = parseWorkflowTemplate(raw);
  if (data && typeof data === "object" && data.prompt && typeof data.prompt === "object") {
    return restore(JSON.stringify(data.prompt, null, 2));
  }
  return restore(JSON.stringify(data, null, 2));
}
