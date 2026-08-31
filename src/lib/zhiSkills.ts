/** 陪玩姬 skill catalog: model picks from this list; writes stay pending until user confirms. */

import type { Character, TimelineEvent } from "@/lib/types";
import type { WorldMeta } from "@/lib/worlds";
import type { WorldLore } from "@/lib/worldLore";
import type { ApplyPatch } from "@/lib/characterChat";
import { fieldsFromPatch } from "@/lib/characterChat";

export type SkillKind = "read" | "write" | "action";

export interface ZhiSkill {
  id: string;
  kind: SkillKind;
  name: string;
  summary: string;
  params: string;
}

export const ZHI_SKILLS: ZhiSkill[] = [
  { id: "list_skills", kind: "read", name: "技能列表", summary: "列出全部技能与用法", params: "" },
  { id: "read_app", kind: "read", name: "总览", summary: "世界、角色数量、当前页", params: "" },
  { id: "list_characters", kind: "read", name: "角色列表", summary: "所有角色卡摘要", params: "" },
  { id: "read_character", kind: "read", name: "读角色卡", summary: "完整人设、外观、快照、时间线、模块", params: "characterName" },
  { id: "read_world", kind: "read", name: "读世界", summary: "世界元数据 + 设定目录", params: "worldName?" },
  { id: "read_lore", kind: "read", name: "读世界设定", summary: "地点/势力/规则/神器/历史/种族全文", params: "worldName" },
  { id: "read_lexicon", kind: "read", name: "读词库", summary: "抽卡姬/生成器词库分类与已启用列表", params: "" },
  { id: "read_comfy", kind: "read", name: "读抽卡姬", summary: "Comfy 地址、工作流、采样参数", params: "" },
  { id: "read_page", kind: "read", name: "读当前页", summary: "当前路径能做什么", params: "" },
  { id: "fill_appearance", kind: "write", name: "旧提示词填外观", summary: "把 prompts 快照拆进脸/身体/服装（待确认）", params: "characterName, label?" },
  { id: "write_appearance", kind: "write", name: "写外观", summary: "改分层外观或增改一套服装（待确认）", params: "characterName, faceFront, outfit{nameCN,upperFront,fullFront}" },
  { id: "write_character", kind: "write", name: "写角色卡", summary: "改人设字段、模块、关系等（待确认）", params: "characterName, fields{}, story?, modules?, note" },
  { id: "add_prompt", kind: "write", name: "加快照", summary: "追加外观提示词快照（待确认）", params: "characterName, label, text" },
  { id: "add_timeline", kind: "write", name: "加时间线", summary: "追加时间线事件（待确认）", params: "characterName, title, description" },
  { id: "add_character", kind: "write", name: "新建角色", summary: "创建角色卡草稿（待确认）", params: "name, world?, fields{}" },
  { id: "delete_character", kind: "write", name: "删除角色", summary: "删除一张卡（待确认）", params: "characterName" },
  { id: "write_world", kind: "write", name: "写世界", summary: "改世界名/颜色/规则系统/DM名单（待确认）", params: "worldName, name?, color?, system?, dmRoster[]" },
  { id: "write_lore", kind: "write", name: "写世界设定", summary: "增改地点/势力/规则/神器/历史/种族（待确认）", params: "worldName, section, entry{}" },
  { id: "generate_image", kind: "action", name: "出图", summary: "用抽卡姬出图，不改卡", params: "characterName?, extra?, outfit?, lexicon?" },
  { id: "goto", kind: "action", name: "跳转", summary: "打开站内页面", params: "path" },
  { id: "roll_lexicon", kind: "action", name: "抽词库", summary: "从抽卡姬词库随机一条（不写卡）", params: "hint" },
];

export function skillListText(): string {
  return ZHI_SKILLS.map((s) => `- ${s.id} [${s.kind}] ${s.summary}${s.params ? ` · ${s.params}` : ""}`).join("\n");
}

export function skillDetailText(): string {
  return ZHI_SKILLS.map((s) => `${s.id}（${s.kind}/${s.name}）：${s.summary}。参数 ${s.params || "无"}`).join("\n");
}

export const SKILL_INSTRUCTION = `先看技能列表，判断这一轮要不要调用、调用哪一个。可以一次调用多个。
读类立刻执行。写类只生成「待确认」草稿，等用户点应用才写入。没有用户确认，禁止说已经改好。
出图/跳转/抽词库是动作，会马上执行。

调用格式（对用户可见正文里不要出现标签）：
<SystemQuery>{"skill":"read_character","characterName":"Ourania"}</SystemQuery>
<SystemQuery>{"skill":"fill_appearance","characterName":"Ourania"}</SystemQuery>
<SystemQuery>{"skill":"write_character","characterName":"Ourania","fields":{"identity":"占星者"},"note":"补身份"}</SystemQuery>
<SystemQuery>{"skill":"generate_image","characterName":"Ourania","extra":"starry night"}</SystemQuery>

禁止只说「稍等/我先调取」而不带 SystemQuery。

## 技能列表
${skillListText()}`;

export type LoreSection = keyof WorldLore;

export interface ZhiPendingChange {
  id: string;
  skill: string;
  title: string;
  summary: string;
  target: string;
  kind: "character" | "create_character" | "delete_character" | "world" | "lore";
  characterId?: string;
  characterPatch?: Partial<Character>;
  timelineEvent?: Omit<TimelineEvent, "id">;
  createDraft?: Partial<Character>;
  worldId?: string;
  worldPatch?: Partial<Pick<WorldMeta, "name" | "color" | "system" | "dmRoster">>;
  loreWorld?: string;
  loreSection?: LoreSection;
  loreEntry?: Record<string, unknown>;
}

export function resolveSkillId(q: Record<string, unknown>): string {
  if (typeof q.skill === "string" && q.skill.trim()) return q.skill.trim();
  const type = String(q.type || "");
  const path = String(q.path || "").toLowerCase();
  if (type === "list_skills" || type === "load_module") return "list_skills";
  if (type === "read" || type === "browse") {
    if (path.startsWith("comfy")) return "read_comfy";
    if (path.startsWith("lexicon") || path.startsWith("词库")) return "read_lexicon";
    if (path.startsWith("lore") || path.startsWith("worldlore")) return "read_lore";
    if (path.startsWith("world")) return "read_world";
    if (path === "characters" || path === "") return "list_characters";
    if (path.startsWith("character")) return "read_character";
    if (path === "page" || path === "app") return path === "page" ? "read_page" : "read_app";
    return "read_character";
  }
  if (type === "write_appearance") return "write_appearance";
  if (type === "fill_appearance_from_prompts") return "fill_appearance";
  if (type === "generate_image") return "generate_image";
  if (type === "ui_action") return "goto";
  if (type === "write_character" || type === "apply") return "write_character";
  return type || "list_skills";
}

export function pendingFromApply(p: ApplyPatch, target: Character): ZhiPendingChange {
  const fields = fieldsFromPatch(p);
  const patch: Partial<Character> = {};
  for (const [k, v] of Object.entries(fields)) {
    (patch as Record<string, unknown>)[k] = v;
  }
  if (p.addPrompt?.text) {
    patch.prompts = [
      ...(target.prompts || []),
      {
        id: crypto.randomUUID(),
        text: p.addPrompt.text,
        label: p.addPrompt.label || "陪玩姬",
        createdAt: new Date().toISOString(),
      },
    ];
  }
  const bits: string[] = [];
  if (Object.keys(fields).length) bits.push(`字段 ${Object.keys(fields).join("、")}`);
  if (p.addPrompt) bits.push(`快照 ${p.addPrompt.label || ""}`);
  if (p.addTimeline) bits.push(`时间线 ${p.addTimeline.title}`);
  return {
    id: crypto.randomUUID(),
    skill: "write_character",
    title: `改 ${target.name}`,
    summary: p.note || bits.join("；") || "改卡",
    target: target.name,
    kind: "character",
    characterId: target.id,
    characterPatch: Object.keys(patch).length ? patch : undefined,
    timelineEvent: p.addTimeline?.title
      ? {
          date: new Date().toISOString().slice(0, 10),
          title: p.addTimeline.title,
          description: p.addTimeline.description || "",
          importance: "normal",
        }
      : undefined,
  };
}