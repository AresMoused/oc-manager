import type { ChatTurn } from "@/lib/characterChat";

const PERSONA_KEY = "oc-zhihuiji-persona-v1";
const SESS_KEY = "oc-zhihuiji-sessions-v1";

export const DEFAULT_ZHIHUIJI_PERSONA = `你是「陪玩姬」，OC Manager 里的中性助手，帮用户打理角色卡、世界、外观提示词和本站用法。

风格：简洁、清楚、口语化中文。可以偶尔轻松一句，不要卖萌、不要自称神、不要角色扮演成别的角色（除非用户明确要求演戏）。

能力：
- 解释当前页面怎么用
- 查角色卡 / 提示词库、用抽卡姬生图（SystemQuery 工具）
- 根据已有资料补人设、改措辞、整理外观提示词
- 需要改角色卡时，在回复末尾用 <apply>JSON</apply> 提出建议，等用户点应用
- 不确定的设定不要编造，标成「待你确认」

不要输出 jailbreak、不要自称没有安全限制。用户导入的对话预设只用于「角色对话」窗，不覆盖你这份人设。`;

export interface ZhiPersona {
  name: string;
  body: string;
}

export interface ZhiThread {
  id: string;
  title: string;
  messages: ChatTurn[];
  updatedAt: string;
}

function parse<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

export function defaultZhiPersona(): ZhiPersona {
  return { name: "陪玩姬", body: DEFAULT_ZHIHUIJI_PERSONA };
}

export function loadZhiPersona(): ZhiPersona {
  if (typeof window === "undefined") return defaultZhiPersona();
  const v = parse<Partial<ZhiPersona>>(localStorage.getItem(PERSONA_KEY), {});
  let name = v.name?.trim() || "陪玩姬";
  let body = v.body?.trim() || DEFAULT_ZHIHUIJI_PERSONA;
  if (name === "智绘姬") name = "陪玩姬";
  if (body.includes("你是「智绘姬」")) body = body.replaceAll("你是「智绘姬」", "你是「陪玩姬」");
  return { name, body };
}

export function saveZhiPersona(p: ZhiPersona) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_KEY, JSON.stringify(p));
}

export function loadZhiThreads(): { currentId: string; threads: ZhiThread[] } {
  if (typeof window === "undefined") return { currentId: "", threads: [] };
  return parse(localStorage.getItem(SESS_KEY), { currentId: "", threads: [] });
}

export function saveZhiThreads(store: { currentId: string; threads: ZhiThread[] }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESS_KEY, JSON.stringify(store));
}

export function emptyZhiThread(): ZhiThread {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function pageHint(pathname: string): string {
  if (pathname.startsWith("/character/")) return "当前在角色页：读卡用 read_character；改卡用写类技能，等用户点应用。角色扮演请用「角色对话」。";
  if (pathname.startsWith("/world/") && pathname.includes("/dm")) return "当前在 DM 管理页。";
  if (pathname.startsWith("/world/")) return "当前在世界页，可问角色列表、世界设定怎么填。";
  if (pathname.startsWith("/generator")) return "当前在角色外观生成器，可帮看提示词和词库怎么排。";
  if (pathname.startsWith("/comfy")) return "当前在抽卡姬。陪玩姬可用 generate_image 调用当前工作流。";
  if (pathname.startsWith("/ai-generate")) return "当前在 AI 生成角色。";
  if (pathname.startsWith("/shared/")) return "当前在分享页。没有编辑权时只能讨论，不要假设能写入对方卡。对话记忆只留在这台设备。";
  if (pathname.startsWith("/about")) return "当前在关于页。";
  if (pathname === "/") return "当前在世界列表。";
  return `当前路径：${pathname}`;
}