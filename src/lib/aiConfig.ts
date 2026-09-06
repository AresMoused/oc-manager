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
    id: "default-oc-card-v2",
    name: "OC完整角色卡",
    updatedAt: now,
    entries: [
      {
        id: "sys-1",
        role: "system",
        name: "System",
        content: `你是 OC Manager 的角色卡写手。用户给概念、参考图或残缺设定，你输出一张可直接导入的角色卡 JSON。

只输出 JSON，不要 markdown 围栏，不要解释，不要思考过程。

根对象可以是角色本身，或 { "version": 3, "format": "oc-manager-single-character", "character": { ... } }。

【必填字段】
name, gender, age, race, height, weight, affiliation, identity, residence, faction, birthplace, world, sheetRole("pc"|"npc"), story

【性格与模块】中文
traits: [{id,leftLabel,rightLabel,value:0-100}] 默认轴：乐观/悲观、开放/保守、感性/理性、果断/犹豫、健谈/寡言、冒险/谨慎、随和/挑剔
emotions: [{id,leftLabel,rightLabel,value:1-5}] 外向/内向、积极/消极、勇敢/胆小、热情/冷漠、勤奋/懒惰、慷慨/吝啬、诚实/虚伪、宽容/苛刻、坚强/脆弱、开朗/忧郁
happiness: [{id,label,value:1-5}] 家庭、情感、健康、经济、人际、地位、成长、心理、自主
outward: [{id,label,value:1-5}] 平凡、乐天、平静、高效、友善、稳重
combat: {experience,collaboration,conflict,intelligence,adaptability} 各 0-100
preferences: [{title,content}] 2-4 条日常喜好，每条 80-180 字
timeline: [{date:"YYYY-MM-DD",title,description,importance:"normal"|"major"|"critical"}] 0-3 条经历，标题带人名

【外观 appearance】英文 Danbooru tags，逗号分隔，禁止分号和中文。
nameCN 中文名；nameEN 小写英文调用名
face / upperSfw / fullSfw / upperNsfw / fullNsfw 各 {front, back}
- face: 脸、发、瞳、耳、体型要点
- upper*: 上半身可见的脸+胸+肩
- full*: 下半身/全身补充（腿、裙、私处等），没有就空字符串
- nsfw 层只写比 sfw 多出来的裸露部位（nipples, pussy 等），不要重复整段脸
outfits: 1-4 套 [{id, nameCN, nameEN, upper:{front,back}, full:{front,back}}]
- id 用英文下划线，如 Char_daily
- upper=上半身服装，full=下半身/裙摆/鞋
- 调用名 nameEN 供宏 \${"name":"Name","upperBody":"visible","lowerBody":"visible"}$
activeOutfitId 填默认那套 id
prompts: [{label,text}] 至少一条「角色」外观快照（1girl/1boy + 种族 + 发瞳）

【不要生成】
id, createdAt, updatedAt, avatar, gallery, modules, relationships, play, photoPrompt

【文风】
story 用第一人称，800-1600 字，只写经历与性格，不要写死结局。中文。外观 tags 必须英文。`,
        enabled: true,
      },
      {
        id: "ai-1",
        role: "assistant",
        name: "AI回复 1",
        content: "明白。给我概念、参考或残缺设定，我只输出完整角色卡 JSON。",
        enabled: true,
      },
      {
        id: "usr-schema",
        role: "user",
        name: "格式",
        content: `输出骨架（填满，不要留说明文字）：
{
  "name": "",
  "gender": "女",
  "age": "",
  "race": "",
  "height": "",
  "weight": "",
  "affiliation": "",
  "identity": "",
  "residence": "",
  "faction": "",
  "birthplace": "",
  "world": "",
  "sheetRole": "pc",
  "story": "",
  "traits": [{"id":"optimistic","leftLabel":"乐观","rightLabel":"悲观","value":50}],
  "emotions": [{"id":"extrovert","leftLabel":"外向","rightLabel":"内向","value":3}],
  "happiness": [{"id":"family","label":"家庭","value":3}],
  "outward": [{"id":"friendly","label":"友善","value":3}],
  "combat": {"experience":40,"collaboration":50,"conflict":40,"intelligence":50,"adaptability":50},
  "preferences": [{"title":"","content":""}],
  "timeline": [],
  "prompts": [{"label":"角色","text":"1girl, elf, pointy ears, blue eyes, blonde hair, long hair"}],
  "appearance": {
    "nameCN": "",
    "nameEN": "",
    "negative": "",
    "face": {"front":"", "back":""},
    "upperSfw": {"front":"", "back":""},
    "fullSfw": {"front":"", "back":""},
    "upperNsfw": {"front":"", "back":""},
    "fullNsfw": {"front":"", "back":""},
    "outfits": [
      {
        "id": "daily",
        "nameCN": "日常",
        "nameEN": "daily",
        "upper": {"front":"", "back":""},
        "full": {"front":"", "back":""}
      }
    ],
    "activeOutfitId": "daily"
  }
}`,
        enabled: true,
      },
      {
        id: "ai-2",
        role: "assistant",
        name: "AI回复 2",
        content: "骨架收到。请给角色概念，我将只输出 JSON。",
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
  const fresh = defaultCharacterPreset();
  if (!list.length) {
    savePresets([fresh]);
    return [fresh];
  }
  if (!list.some((p) => p.id === fresh.id || p.name === fresh.name)) {
    const next = [fresh, ...list];
    savePresets(next);
    return next;
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
    let reasoning = "";
    let finish = "";
    let usage: unknown = null;
    if (!config.stream) {
      const data = await res.json();
      const msg = data.choices?.[0]?.message || {};
      text = String(msg.content || "");
      reasoning = String(msg.reasoning_content || msg.reasoning || "");
      finish = String(data.choices?.[0]?.finish_reason || "");
      usage = data.usage || null;
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
            const choice = json.choices?.[0] || {};
            const delta = choice.delta || {};
            const piece = delta.content || choice.message?.content || "";
            const think =
              delta.reasoning_content ||
              delta.reasoning ||
              choice.message?.reasoning_content ||
              "";
            if (piece) {
              full += piece;
              onDelta?.(full);
            }
            if (think) reasoning += think;
            if (choice.finish_reason) finish = String(choice.finish_reason);
            if (json.usage) usage = json.usage;
          } catch {
            /* skip */
          }
        }
      }
      text = full;
    }
    if (!text.trim() && reasoning.trim()) text = reasoning;
    log("chat", {
      model: config.model,
      ms: Date.now() - started,
      messages: slim,
      reply: text,
      reasoning: reasoning && reasoning !== text ? reasoning.slice(0, 4000) : undefined,
      finish,
      usage,
      empty: !text.trim(),
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
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    if (obj && typeof obj.character === "object" && obj.character) {
      return obj.character as Record<string, unknown>;
    }
    return obj;
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
