/** ComfyUI connection, workflow templates, and generation params (browser local) */

export interface ComfyWorkflowTemplate {
  id: string;
  name: string;
  workflow: string;
  createdAt: string;
  updatedAt: string;
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
  return { baseUrl: "http://127.0.0.1:8188", activeWorkflowId: "" };
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

export async function comfyWaitForImages(
  baseUrl: string, promptId: string,
  opts?: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal }
): Promise<ComfyHistoryImage[]> {
  const root = baseUrl.replace(/\/+$/, "");
  const timeout = opts?.timeoutMs ?? 300_000;
  const poll = opts?.pollMs ?? 1200;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await fetch(`${root}/history/${promptId}`, { signal: opts?.signal });
    if (res.ok) {
      const data = await res.json();
      const entry = data[promptId];
      if (entry?.outputs) {
        const images: ComfyHistoryImage[] = [];
        for (const nodeId of Object.keys(entry.outputs)) {
          const out = entry.outputs[nodeId];
          if (out?.images && Array.isArray(out.images)) {
            for (const img of out.images) {
              images.push({ filename: img.filename, subfolder: img.subfolder || "", type: img.type || "output" });
            }
          }
        }
        if (images.length > 0 || entry.status?.completed) return images;
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

export function normalizeWorkflowUpload(raw: string): string {
  const { data, restore } = parseWorkflowTemplate(raw);
  if (data && typeof data === "object" && data.prompt && typeof data.prompt === "object") {
    return restore(JSON.stringify(data.prompt, null, 2));
  }
  return restore(JSON.stringify(data, null, 2));
}
