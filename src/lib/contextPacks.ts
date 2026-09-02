/** 智绘姬-style context packs + request-type bindings. */

import type { ChatPromptEntry } from "@/lib/characterChat";

const PACKS_KEY = "oc-context-packs-v1";
const TYPES_KEY = "oc-request-types-v1";

export interface ContextPack {
  id: string;
  name: string;
  entries: ChatPromptEntry[];
  importedAt: string;
}

export interface RequestType {
  id: string;
  name: string;
  blurb: string;
  packId: string;
}

export const BUILTIN_IMAGE_PACK_ID = "builtin-image";

export const DEFAULT_REQUEST_TYPES: RequestType[] = [
  { id: "image_body", name: "正文图片生成", blurb: "从对话/正文写插图提示词，再交给抽卡姬", packId: BUILTIN_IMAGE_PACK_ID },
  { id: "design", name: "角色/服装设计", blurb: "设计分层外观或新服装（写类技能仍要你确认）", packId: "" },
  { id: "show", name: "角色/服装展示", blurb: "对话出图默认用这一项写提示词", packId: BUILTIN_IMAGE_PACK_ID },
  { id: "edit", name: "角色/服装修改", blurb: "按对话改外观词", packId: "" },
  { id: "translate", name: "翻译", blurb: "中英 tag / 人设翻译", packId: "" },
  { id: "tags", name: "Tag 修改", blurb: "整理、去重、补全 Danbooru tag", packId: "" },
  { id: "assistant", name: "陪玩姬助手", blurb: "主对话使用人设面板，不走这项上下文", packId: "" },
  { id: "persona", name: "角色人设生成", blurb: "生成角色卡字段", packId: "" },
  { id: "user_persona", name: "User 人设生成", blurb: "生成玩家人设", packId: "" },
  { id: "summary", name: "聊天总结", blurb: "对话摘要写入时间线", packId: "" },
];

export const BUILTIN_IMAGE_PACK: ContextPack = {
  id: BUILTIN_IMAGE_PACK_ID,
  name: "内置·对话出图",
  importedAt: "",
  entries: [
    {
      id: "img-sys",
      identifier: "img-sys",
      name: "出图提示词规则",
      role: "system",
      enabled: true,
      marker: false,
      content: `你是 OC Manager 的出图提示词写手。根据角色外观层和当前对话，写一张插图的英文提示词。

输出格式（只出一块）：
image###tags, short english scene###

规则：
- 英文 comma 分隔，不要中文、不要分号
- 开头写人数（1girl / 1boy / 1girl, 1boy）
- 只画「角色启用列表」里的那一个，不要画玩家或其他角色
- 外貌必须用「角色启用列表 / 完整提示词」里的脸、身体、服装和提示词快照，不要编外貌
- 姿势、表情、场景、构图跟对话走
- 可用宏 \${"name":"角色英文名","angle":"front","upperBody":"sfw","lowerBody":"hidden"}$ 引用卡内外观
- 不要解释、不要重复正文`,
    },
    {
      id: "img-ctx",
      identifier: "img-ctx",
      name: "资料",
      role: "user",
      enabled: true,
      marker: false,
      content: `角色启用列表：
{{角色启用列表}}

服装列表：
{{通用服装启用列表}}

近期对话：
{{上下文}}

本次需求：
{{用户需求}}

正文/场景：
{{正文}}`,
    },
    {
      id: "img-go",
      identifier: "img-go",
      name: "开始",
      role: "user",
      enabled: true,
      marker: false,
      content: "只输出一组 image### ... ### 。",
    },
  ],
};

function parse<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

function asEntry(p: Record<string, unknown>, i: number): ChatPromptEntry {
  const role: ChatPromptEntry["role"] =
    p.role === "assistant" || p.role === "user" ? p.role : "system";
  return {
    id: String(p.id || p.identifier || `e-${i}`),
    identifier: String(p.identifier || p.id || ""),
    name: String(p.name || `条目 ${i + 1}`),
    role,
    content: String(p.content || ""),
    enabled: p.enabled !== false,
    marker: !!p.marker,
    triggerMode: String(p.triggerMode || "always"),
  };
}

export function parseContextPacks(raw: string): ContextPack[] {
  const data = JSON.parse(raw) as unknown;
  const now = new Date().toISOString();
  if (data && typeof data === "object" && Array.isArray((data as { prompts?: unknown }).prompts)) {
    const d = data as { name?: string; prompts: Record<string, unknown>[] };
    return [
      {
        id: crypto.randomUUID(),
        name: String(d.name || "导入的预设"),
        importedAt: now,
        entries: d.prompts.map((p, i) => asEntry(p, i)),
      },
    ];
  }
  if (data && typeof data === "object") {
    const packs: ContextPack[] = [];
    for (const [name, val] of Object.entries(data as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const entries = (val as { entries?: unknown }).entries;
      if (!Array.isArray(entries)) continue;
      packs.push({
        id: crypto.randomUUID(),
        name,
        importedAt: now,
        entries: entries.map((p, i) => asEntry((p || {}) as Record<string, unknown>, i)),
      });
    }
    if (packs.length) return packs;
  }
  throw new Error("无法识别上下文预设（需要 { 名称: { entries: [] } } 或 SillyTavern prompts）");
}

export function loadContextPacks(): ContextPack[] {
  if (typeof window === "undefined") return [];
  return parse<ContextPack[]>(localStorage.getItem(PACKS_KEY), []);
}

export function saveContextPacks(list: ContextPack[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PACKS_KEY, JSON.stringify(list));
}

export function loadRequestTypes(): RequestType[] {
  if (typeof window === "undefined") return DEFAULT_REQUEST_TYPES;
  const saved = parse<RequestType[]>(localStorage.getItem(TYPES_KEY), []);
  const byId = new Map(saved.map((t) => [t.id, t]));
  return DEFAULT_REQUEST_TYPES.map((d) => {
    const s = byId.get(d.id);
    return s ? { ...d, packId: s.packId } : d;
  });
}

export function saveRequestTypes(list: RequestType[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TYPES_KEY, JSON.stringify(list));
}

export function allPacks(): ContextPack[] {
  return [BUILTIN_IMAGE_PACK, ...loadContextPacks()];
}

export function findPack(id: string): ContextPack | undefined {
  if (!id) return undefined;
  if (id === BUILTIN_IMAGE_PACK_ID) return BUILTIN_IMAGE_PACK;
  return loadContextPacks().find((p) => p.id === id);
}

export function packForRequest(typeId: string): ContextPack | undefined {
  const t = loadRequestTypes().find((x) => x.id === typeId);
  return t?.packId ? findPack(t.packId) : undefined;
}

/** 出图：优先「展示」，否则「正文图片生成」，否则内置。 */
export function packForImage(): ContextPack {
  return packForRequest("show") || packForRequest("image_body") || BUILTIN_IMAGE_PACK;
}