/** Browser-local AI API config, params, and context presets */

import { pushDebugLog } from "@/lib/debugLog";

export interface AiApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  stream: boolean;
  noTavernProxy: boolean;
  mergeSystemUser: boolean;
  sendImages: boolean;
  models: string[];
}

export interface AiModelParams {
  temperature: number;
  topP: number;
  maxTokens: number;
}

export type ContextRole = "system" | "user" | "assistant";

export interface ContextEntry {
  id: string;
  role: ContextRole;
  name: string;
  content: string;
  enabled: boolean;
}

export interface ContextPreset {
  id: string;
  name: string;
  entries: ContextEntry[];
  updatedAt: string;
}

const API_KEY = "oc-ai-api-config-v1";
const PARAMS_KEY = "oc-ai-model-params-v1";
const PRESETS_KEY = "oc-ai-context-presets-v1";
const ACTIVE_PRESET_KEY = "oc-ai-active-preset-v1";

export const defaultApiConfig = (): AiApiConfig => ({
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-chat",
  stream: true,
  noTavernProxy: false,
  mergeSystemUser: false,
  sendImages: false,
  models: [],
});

export const defaultModelParams = (): AiModelParams => ({
  temperature: 1,
  topP: 1,
  maxTokens: 3000,
});

export function defaultCharacterPreset(): ContextPreset {
  const now = new Date().toISOString();
  return {
    id: "default-oc-design",
    name: "角色卡设计默认",
    updatedAt: now,
    entries: [
      {
        id: "sys-1",
        role: "system",
        name: "System",
        content:
          "你是一位专业的 TRPG / 原创角色（OC）设定助手。用户会描述角色概念，你需要输出完整的角色卡 JSON。只输出 JSON，不要 markdown 代码块以外的解释。字段：name, gender, age, race, height, weight, affiliation, identity, residence, faction, birthplace, story, traits(数组{leftLabel,rightLabel,value:0-100}，rightLabel可空), preferences(数组{title,content}), combat({experience,collaboration,conflict,intelligence,adaptability} 0-100)。中文填写。",
        enabled: true,
      },
      {
        id: "ai-1",
        role: "assistant",
        name: "AI回复 1",
        content: "明白啦！好朋友。很高兴和你合作！那么你有参考资料吗？",
        enabled: true,
      },
      {
        id: "usr-2",
        role: "user",
        name: "用户消息 2",
        content:
          "************<参考资料>**************** 请根据用户后续给出的设定来设计角色。",
        enabled: true,
      },
      {
        id: "ai-2",
        role: "assistant",
        name: "AI回复 2",
        content: "我了解了。真是个精彩的设定。告诉我怎么描述角色的外貌设定吧。",
        enabled: true,
      },
      {
        id: "usr-3",
        role: "user",
        name: "用户消息 3",
        content:
          "有道理。**重要原则：角色设计只描述设定与性格，不要写死剧情结局。**",
        enabled: true,
      },
    ],
  };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadApiConfig(): AiApiConfig {
  if (typeof window === "undefined") return defaultApiConfig();
  return {
    ...defaultApiConfig(),
    ...safeParse(localStorage.getItem(API_KEY), {}),
  };
}

export function saveApiConfig(cfg: AiApiConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY, JSON.stringify(cfg));
}

export function loadModelParams(): AiModelParams {
  if (typeof window === "undefined") return defaultModelParams();
  return {
    ...defaultModelParams(),
    ...safeParse(localStorage.getItem(PARAMS_KEY), {}),
  };
}

export function saveModelParams(p: AiModelParams) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
}

export function loadPresets(): ContextPreset[] {
  if (typeof window === "undefined") return [defaultCharacterPreset()];
  const list = safeParse<ContextPreset[]>(localStorage.getItem(PRESETS_KEY), []);
  if (!list.length) {
    const d = defaultCharacterPreset();
    savePresets([d]);
    return [d];
  }
  return list;
}

export function savePresets(list: ContextPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

export function loadActivePresetId(): string {
  if (typeof window === "undefined") return "default-oc-design";
  return localStorage.getItem(ACTIVE_PRESET_KEY) || "default-oc-design";
}

export function saveActivePresetId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

export async function fetchModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const root = baseUrl.replace(/\/+$/, "");
  const url = root.endsWith("/v1") ? `${root}/models` : `${root}/v1/models`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`获取模型失败: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const ids: string[] = (data.data || data.models || [])
    .map((m: { id?: string; name?: string }) => m.id || m.name)
    .filter(Boolean);
  return Array.from(new Set(ids)).sort();
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

function buildMessages(
  preset: ContextPreset,
  userPrompt: string,
  mergeSystemUser: boolean
): ChatMessage[] {
  const enabled = preset.entries.filter((e) => e.enabled && e.content.trim());
  const msgs: ChatMessage[] = enabled.map((e) => ({
    role: e.role,
    content: e.content,
  }));

  if (mergeSystemUser) {
    const merged: ChatMessage[] = [];
    for (const m of msgs) {
      const last = merged[merged.length - 1];
      if (
        last &&
        ((last.role === "system" && m.role === "user") ||
          (last.role === "user" && m.role === "system") ||
          (last.role === "user" && m.role === "user") ||
          (last.role === "system" && m.role === "system"))
      ) {
        last.content = last.content + "\n\n" + m.content;
        last.role = "user";
      } else {
        merged.push({ ...m });
      }
    }
    msgs.length = 0;
    msgs.push(...merged);
  }

  msgs.push({ role: "user", content: userPrompt });
  return msgs;
}

export async function completeChat(opts: {
  config: AiApiConfig;
  params: AiModelParams;
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  logSource?: string;
  logTitle?: string;
}): Promise<string> {
  const { config, params, messages, onDelta, signal } = opts;
  const started = Date.now();
  const slim = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
  const log = (kind: "chat" | "error", extra: Record<string, unknown>) => {
    if (!opts.logSource) return;
    pushDebugLog({
      source: opts.logSource,
      kind,
      title: opts.logTitle || `${config.model} · ${slim.length} 条`,
      payload: extra,
    });
  };
  try {
    const root = config.baseUrl.replace(/\/+$/, "");
    const url = root.endsWith("/v1")
      ? `${root}/chat/completions`
      : `${root}/v1/chat/completions`;

    const body = {
      model: config.model,
      messages,
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      stream: config.stream,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`API 错误 ${res.status}: ${await res.text()}`);
    }

    let text = "";
    if (!config.stream) {
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    } else {
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取流式响应");
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta =
              json.choices?.[0]?.delta?.content ||
              json.choices?.[0]?.message?.content ||
              "";
            if (delta) {
              full += delta;
              onDelta?.(full);
            }
          } catch {
            /* skip */
          }
        }
      }
      text = full;
    }
    log("chat", {
      model: config.model,
      ms: Date.now() - started,
      messages: slim,
      reply: text,
    });
    return text;
  } catch (e) {
    log("error", {
      model: config.model,
      ms: Date.now() - started,
      messages: slim,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export async function chatCompletion(opts: {
  config: AiApiConfig;
  params: AiModelParams;
  preset: ContextPreset;
  userPrompt: string;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  logSource?: string;
  logTitle?: string;
}): Promise<string> {
  const messages = buildMessages(
    opts.preset,
    opts.userPrompt,
    opts.config.mergeSystemUser
  );
  return completeChat({
    config: opts.config,
    params: opts.params,
    messages,
    onDelta: opts.onDelta,
    signal: opts.signal,
    logSource: opts.logSource,
    logTitle: opts.logTitle,
  });
}

export function parseCharacterJson(
  text: string
): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* find object */
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}
