/** Character-page roleplay chat: ST-preset import, context, memory. */

import type { Character, PreferenceItem, SheetModule, TimelineEvent } from "@/lib/types";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { defaultApiConfig, defaultModelParams } from "@/lib/aiConfig";
import { applyRegexes, collectStRegexes, type ChatRegex } from "@/lib/chatRegex";

const API_KEY = "oc-char-chat-api-v1";
const PARAMS_KEY = "oc-char-chat-params-v1";
const PRESET_KEY = "oc-char-chat-preset-v1";
const SESSION_KEY = "oc-char-chat-sessions-v1";
const PERSONA_KEY = "oc-char-chat-test-persona-v1";

export type SoloMode = "monologue" | "mystery";

export interface ChatPromptEntry {
  id: string;
  identifier: string;
  name: string;
  role: "system" | "user" | "assistant";
  content: string;
  enabled: boolean;
  marker: boolean;
}

export interface ChatPresetFile {
  name: string;
  importedAt: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  entries: ChatPromptEntry[];
  regexes: ChatRegex[];
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  speakerId?: string;
  speakerName: string;
  content: string;
  imageUrl?: string;
  at: string;
  summarized?: boolean;
}

export interface ChatSummary {
  id: string;
  at: string;
  title: string;
  description: string;
  names: string[];
}

export interface ChatSession {
  id: string;
  hostId: string;
  title: string;
  participantIds: string[];
  povId: string;
  soloMode: SoloMode;
  scene: string;
  autoSummary: boolean;
  allowCardEdit: boolean;
  useTestPersona: boolean;
  messages: ChatTurn[];
  summaries: ChatSummary[];
  updatedAt: string;
}

export interface TestPersona {
  name: string;
  body: string;
}

type HostStore = { currentId: string; threads: ChatSession[] };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadChatApiConfig(): AiApiConfig {
  if (typeof window === "undefined") return defaultApiConfig();
  return { ...defaultApiConfig(), ...safeParse(localStorage.getItem(API_KEY), {}) };
}

export function saveChatApiConfig(cfg: AiApiConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY, JSON.stringify(cfg));
}

export function loadChatParams(): AiModelParams {
  if (typeof window === "undefined") return defaultModelParams();
  return { ...defaultModelParams(), ...safeParse(localStorage.getItem(PARAMS_KEY), {}) };
}

export function saveChatParams(p: AiModelParams) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
}

export function loadChatPreset(): ChatPresetFile | null {
  if (typeof window === "undefined") return null;
  const p = safeParse<ChatPresetFile | null>(localStorage.getItem(PRESET_KEY), null);
  if (p && !p.regexes) p.regexes = [];
  return p;
}

export function saveChatPreset(p: ChatPresetFile | null) {
  if (typeof window === "undefined") return;
  if (!p) localStorage.removeItem(PRESET_KEY);
  else localStorage.setItem(PRESET_KEY, JSON.stringify(p));
}

export function loadTestPersona(): TestPersona {
  if (typeof window === "undefined") return { name: "玩家", body: "" };
  return {
    name: "玩家",
    body: "",
    ...safeParse<Partial<TestPersona>>(localStorage.getItem(PERSONA_KEY), {}),
  };
}

export function saveTestPersona(p: TestPersona) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_KEY, JSON.stringify(p));
}

export function loadHostStore(hostId: string): HostStore {
  if (typeof window === "undefined") return { currentId: "", threads: [] };
  const raw = safeParse<Record<string, unknown>>(localStorage.getItem(SESSION_KEY), {});
  const entry = raw[hostId];
  if (!entry || typeof entry !== "object") return { currentId: "", threads: [] };
  const obj = entry as Record<string, unknown>;
  if (Array.isArray(obj.threads)) {
    return {
      currentId: String(obj.currentId || ""),
      threads: obj.threads as ChatSession[],
    };
  }
  const legacy = entry as ChatSession;
  if (legacy && Array.isArray(legacy.messages)) {
    const thread: ChatSession = {
      ...emptySession(hostId),
      ...legacy,
      id: legacy.id || crypto.randomUUID(),
      title: legacy.title || "对话",
      summaries: legacy.summaries || [],
    };
    return { currentId: thread.id, threads: [thread] };
  }
  return { currentId: "", threads: [] };
}

export function saveHostStore(hostId: string, store: HostStore) {
  if (typeof window === "undefined") return;
  const raw = safeParse<Record<string, unknown>>(localStorage.getItem(SESSION_KEY), {});
  raw[hostId] = store;
  localStorage.setItem(SESSION_KEY, JSON.stringify(raw));
}

export function loadChatSession(hostId: string): ChatSession | null {
  const store = loadHostStore(hostId);
  return store.threads.find((t) => t.id === store.currentId) || store.threads[0] || null;
}

export function saveChatSession(session: ChatSession) {
  const store = loadHostStore(session.hostId);
  const i = store.threads.findIndex((t) => t.id === session.id);
  const next = { ...session, updatedAt: new Date().toISOString() };
  if (i >= 0) store.threads[i] = next;
  else store.threads.unshift(next);
  store.currentId = session.id;
  saveHostStore(session.hostId, store);
}

export function listChatThreads(hostId: string): ChatSession[] {
  return loadHostStore(hostId).threads;
}

export function deleteChatThread(hostId: string, threadId: string) {
  const store = loadHostStore(hostId);
  store.threads = store.threads.filter((t) => t.id !== threadId);
  if (store.currentId === threadId) store.currentId = store.threads[0]?.id || "";
  saveHostStore(hostId, store);
}

export function emptySession(hostId: string): ChatSession {
  return {
    id: crypto.randomUUID(),
    hostId,
    title: "新对话",
    participantIds: [hostId],
    povId: hostId,
    soloMode: "mystery",
    scene: "",
    autoSummary: true,
    allowCardEdit: true,
    useTestPersona: false,
    messages: [],
    summaries: [],
    updatedAt: new Date().toISOString(),
  };
}

export function parseSillyTavernPreset(raw: string): ChatPresetFile {
  const data = JSON.parse(raw);
  const prompts = Array.isArray(data?.prompts) ? data.prompts : null;
  if (!prompts) throw new Error("不是 SillyTavern Chat Completion 预设（缺少 prompts）");
  const entries: ChatPromptEntry[] = [];
  for (const p of prompts) {
    if (!p || typeof p !== "object") continue;
    if (p.identifier === "regexes-bindings") continue;
    const role: ChatPromptEntry["role"] =
      p.role === "assistant" || p.role === "user" ? p.role : "system";
    entries.push({
      id: String(p.identifier || p.name || crypto.randomUUID()),
      identifier: String(p.identifier || ""),
      name: String(p.name || p.identifier || "未命名"),
      role,
      content: String(p.content || ""),
      enabled: p.enabled !== false,
      marker: !!p.marker,
    });
  }
  if (!entries.length) throw new Error("预设里没有可用条目");
  return {
    name: String(data.name || data.presetName || "导入的对话预设"),
    importedAt: new Date().toISOString(),
    temperature: typeof data.temperature === "number" ? data.temperature : undefined,
    topP: typeof data.top_p === "number" ? data.top_p : undefined,
    maxTokens:
      typeof data.openai_max_tokens === "number" ? data.openai_max_tokens : undefined,
    entries,
    regexes: collectStRegexes(data),
  };
}

function moduleLines(modules: SheetModule[] | undefined): string[] {
  const out: string[] = [];
  for (const m of modules || []) {
    if (m.type === "sliders") {
      const bits = m.items.map((it) => {
        const right = it.rightLabel ? `↔${it.rightLabel}` : "";
        return `${it.leftLabel}${right}:${it.value}`;
      });
      if (bits.length) out.push(`${m.title}：${bits.join("，")}`);
    } else if (m.type === "radar") {
      out.push(`${m.title}：${m.axes.map((a) => `${a.label}:${a.value}`).join("，")}`);
    } else if (m.type === "text-list") {
      const items = (m.items as PreferenceItem[])
        .map((it) => `${it.title}${it.content ? "：" + it.content : ""}`)
        .filter(Boolean);
      if (items.length) out.push(`${m.title}：${items.join("；")}`);
    } else if (m.type === "text-long" && m.body.trim()) {
      out.push(`${m.title}：${m.body.trim().slice(0, 600)}`);
    }
  }
  return out;
}

export function characterCardText(
  c: Character,
  present: Character[],
  timelineLimit = 8
): string {
  const lines = [
    `姓名：${c.name}`,
    `性别：${c.gender}　年龄：${c.age}　种族：${c.race}`,
    `身份：${c.identity}　阵营：${c.affiliation}　派系：${c.faction}`,
    `现住：${c.residence}　出身：${c.birthplace}`,
    `角色类型：${c.sheetRole === "pc" ? "玩家角色" : "NPC"}`,
  ];
  if (c.story.trim()) lines.push(`经历：${c.story.trim().slice(0, 900)}`);
  lines.push(...moduleLines(c.modules));
  const presentIds = new Set(present.map((x) => x.id));
  const rels = (c.relationships || []).filter((r) => presentIds.has(r.targetId));
  if (rels.length) {
    lines.push(
      "与在场者关系：" +
        rels
          .map((r) => {
            const t = present.find((x) => x.id === r.targetId);
            return `${t?.name || r.targetId}（${r.type}${r.note ? "，" + r.note : ""}）`;
          })
          .join("；")
    );
  }
  const tl = (c.timeline || []).slice(-timelineLimit);
  if (tl.length) {
    lines.push("长期记忆（时间线）：");
    for (const e of tl) {
      lines.push(`- [${e.date}] ${e.title}${e.description ? "：" + e.description : ""}`);
    }
  }
  return lines.filter((x) => !x.endsWith("：") && x.replace(/[　\s]/g, "").length > 2).join("\n");
}

export function displayReply(raw: string): string {
  let s = String(raw || "");
  s = s.replace(/<分析喵>[\s\S]*?<\/分析喵>/gi, "");
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/<apply>[\s\S]*?<\/apply>/gi, "");
  const content = s.match(/<content>([\s\S]*?)<\/content>/i);
  if (content) s = content[1] || s;
  s = s.replace(/<summary>[\s\S]*?<\/summary>/gi, "");
  s = s.replace(/<\/?content>/gi, "");
  return s.trim() || String(raw || "").trim();
}

function slotId(e: ChatPromptEntry): string {
  return (e.identifier || e.name || "").toLowerCase();
}

function isHistorySlot(e: ChatPromptEntry): boolean {
  const id = slotId(e);
  return e.marker && (id.includes("chathistory") || id.includes("chat history") || e.name.includes("Chat History"));
}

function fillSlot(e: ChatPromptEntry, filled: string): ChatMessage | null {
  if (!e.enabled) return null;
  const text = filled.trim();
  if (!text && !e.content.trim()) return null;
  const content = e.content.trim() ? `${e.content.trim()}\n${text}` : text;
  return { role: e.role, content };
}

export function recentUnsummarized(messages: ChatTurn[], maxTurns = 5): ChatTurn[] {
  const pending = messages.filter((m) => !m.summarized);
  const userTurns = pending.filter((m) => m.role === "user");
  const keepUsers = userTurns.slice(-maxTurns);
  if (!keepUsers.length) return pending.slice(-maxTurns * 2);
  const first = pending.findIndex((m) => m.id === keepUsers[0]!.id);
  return pending.slice(first < 0 ? 0 : first);
}

export function unsummarizedUserCount(messages: ChatTurn[]): number {
  return messages.filter((m) => m.role === "user" && !m.summarized).length;
}

export function buildChatMessages(opts: {
  preset: ChatPresetFile;
  present: Character[];
  pov: Character;
  soloMode: SoloMode;
  scene: string;
  history: ChatTurn[];
  userLine: string;
  imageUrl?: string;
  allowCardEdit?: boolean;
  testPersona?: TestPersona | null;
}): ChatMessage[] {
  const { preset, present, pov, soloMode, scene, history, userLine, imageUrl, allowCardEdit, testPersona } = opts;
  const others = present.filter((c) => c.id !== pov.id);
  const solo = present.length <= 1;
  const usingTest = !!(testPersona && testPersona.body.trim());
  const playerName = usingTest ? testPersona!.name || "玩家" : pov.name;

  const persona = usingTest
    ? `【玩家视角·测试人设】\n玩家自称「${playerName}」。正式游玩请改用角色卡当人设。\n不要代替玩家说话或做决定。\n\n${testPersona!.body.trim()}`
    : `【玩家视角】\n你正在以「${pov.name}」的第一人称感官写其他角色与环境。不要代替 ${pov.name} 说话或做决定。\n\n${characterCardText(pov, present)}`;
  const chars = others.length
    ? others.map((c) => characterCardText(c, present)).join("\n\n---\n\n")
    : characterCardText(pov, present);
  const worldMem = present
    .map((c) => {
      const tl = (c.timeline || []).slice(-6);
      if (!tl.length) return "";
      return `${c.name}的时间线：\n` + tl.map((e) => `- [${e.date}] ${e.title}：${e.description}`).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  let scenario = scene.trim() ? `当前场景：${scene.trim()}` : "";
  if (solo && soloMode === "monologue") {
    scenario += `\n本场只有 ${playerName}。请写环境与内心独白式回应，不要冒出第二个可对话的具名角色。`;
  } else if (solo && soloMode === "mystery") {
    scenario += `\n本场只有 ${playerName}。另一方是来源不明的神秘声音（不要给它固定真名），与 ${playerName} 对话。`;
  } else if (others.length) {
    scenario += `\n在场其他角色：${others.map((c) => c.name).join("、")}。只写他们的言行，不写 ${playerName} 的行动。`;
  }

  const hist = recentUnsummarized(history, 5);
  const histMsgs: ChatMessage[] = hist.map((t) => ({
    role: t.role,
    content:
      t.role === "user"
        ? applyRegexes(`【${t.speakerName}】\n${t.content}`, preset.regexes, "prompt")
        : applyRegexes(t.content, preset.regexes, "prompt"),
  }));

  const inject: Record<string, string> = {
    persona,
    personadescription: persona,
    chardescription: `【在场角色卡】\n${chars}`,
    charpersonality: `【在场角色性格与模块】\n${chars}`,
    worldinfobefore: worldMem ? `【长期记忆·时间线】\n${worldMem}` : "",
    worldinfoafter: worldMem ? `【长期记忆·时间线】\n${worldMem}` : "",
    worldinfo: worldMem ? `【长期记忆·时间线】\n${worldMem}` : "",
    scenario,
    dialogueexamples: "",
  };

  const out: ChatMessage[] = [];
  let historyPlaced = false;
  for (const e of preset.entries) {
    if (!e.enabled) continue;
    if (isHistorySlot(e)) {
      out.push(...histMsgs);
      historyPlaced = true;
      continue;
    }
    const id = slotId(e).replace(/[^a-z]/g, "");
    let extra = "";
    for (const [k, v] of Object.entries(inject)) {
      if (id.includes(k)) {
        extra = v;
        break;
      }
    }
    if (e.marker) {
      const msg = fillSlot(e, extra);
      if (msg) out.push({ ...msg, content: applyRegexes(String(msg.content), preset.regexes, "prompt") });
      continue;
    }
    const body = extra ? `${e.content}\n${extra}` : e.content;
    if (body.trim()) out.push({ role: e.role, content: applyRegexes(body, preset.regexes, "prompt") });
  }
  if (allowCardEdit) {
    out.push({ role: "system", content: APPLY_INSTRUCTION });
  }
  if (!historyPlaced) out.push(...histMsgs);
  const userText = applyRegexes(`【${playerName}】\n${userLine}`, preset.regexes, "prompt");
  if (imageUrl) {
    out.push({
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    });
  } else {
    out.push({ role: "user", content: userText });
  }
  return out;
}

export const SUMMARY_SYSTEM = `你是剧情记录员。根据对话写一条时间线记忆。
必须写清每个说话或行动的人的名字（用角色名，不要用“他/她”替代主语）。
只输出 JSON，不要 markdown：
{"date":"YYYY-MM-DD","title":"含人名的短标题","description":"100字左右，每句点名是谁在做/说","names":["人名1","人名2"]}`;

export function buildSummaryMessages(turns: ChatTurn[], names: string[]): ChatMessage[] {
  const log = turns
    .map((t) => `${t.role === "user" ? t.speakerName : "对方"}：${displayReply(t.content)}`)
    .join("\n");
  return [
    { role: "system", content: SUMMARY_SYSTEM },
    {
      role: "user",
      content: `在场人物：${names.join("、")}\n\n对话：\n${log}`,
    },
  ];
}

export function parseSummaryJson(raw: string): {
  date: string;
  title: string;
  description: string;
  names: string[];
} | null {
  const m = String(raw || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]!) as {
      date?: string;
      title?: string;
      description?: string;
      names?: string[];
    };
    if (!j.title && !j.description) return null;
    return {
      date: j.date || new Date().toISOString().slice(0, 10),
      title: String(j.title || "对话").slice(0, 80),
      description: String(j.description || "").slice(0, 800),
      names: Array.isArray(j.names) ? j.names.map(String) : [],
    };
  } catch {
    return null;
  }
}

export function toTimelineEvent(
  parsed: NonNullable<ReturnType<typeof parseSummaryJson>>,
  presentNames: string[]
): Omit<TimelineEvent, "id"> {
  const names = [...new Set([...(parsed.names || []), ...presentNames].filter(Boolean))];
  const nameStr = names.join("、");
  const title = parsed.title.includes(names[0] || "") ? parsed.title : `${nameStr}：${parsed.title}`;
  const desc = parsed.description.includes(nameStr.slice(0, 2))
    ? parsed.description
    : `（${nameStr}）\n${parsed.description}`;
  return {
    date: parsed.date,
    title,
    description: desc,
    importance: "normal",
  };
}

const CARD_FIELDS = [
  "story",
  "identity",
  "residence",
  "faction",
  "affiliation",
  "race",
  "gender",
  "age",
  "height",
  "weight",
  "birthplace",
] as const;

export type CardFieldKey = (typeof CARD_FIELDS)[number];

export type ApplyPatch = {
  characterName?: string;
  fields?: Partial<Record<CardFieldKey, string | number>>;
  addPrompt?: { label?: string; text: string };
  addTimeline?: { title: string; description: string };
  note?: string;
};

export const APPLY_INSTRUCTION = `当你要改角色卡/外观/人设时（用户明确要求补设定、更新经历、改外观词），在回复末尾追加：
<apply>
{"characterName":"角色名","fields":{"story":"经历正文","identity":"身份","residence":"现住","faction":"派系"},"addPrompt":{"label":"外观","text":"danbooru tags, "},"addTimeline":{"title":"含人名短标题","description":"点名谁做了什么"},"note":"改了哪些字段"}
</apply>
规则：不要每轮都 apply；角色扮演时不要带 apply。fields 只填要改的键。addPrompt 是外观提示词。characterName 必须是在场角色真名。`;

export function extractApplyPatches(raw: string): ApplyPatch[] {
  const out: ApplyPatch[] = [];
  const re = /<apply>([\s\S]*?)<\/apply>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(raw || "")))) {
    try {
      const j = JSON.parse(m[1]!.trim()) as ApplyPatch;
      if (j && (j.fields || j.addPrompt || j.addTimeline)) out.push(j);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function resolveApplyTarget(
  patch: ApplyPatch,
  present: Character[],
  fallback: Character
): Character {
  const n = (patch.characterName || "").trim();
  if (!n) return fallback;
  return (
    present.find((c) => c.name === n) ||
    present.find((c) => c.name.includes(n) || n.includes(c.name)) ||
    fallback
  );
}

export function fieldsFromPatch(
  patch: ApplyPatch
): Partial<Record<CardFieldKey, string | number>> {
  const src = patch.fields || {};
  const out: Partial<Record<CardFieldKey, string | number>> = {};
  for (const k of CARD_FIELDS) {
    if (src[k] != null && String(src[k]).trim()) out[k] = src[k]!;
  }
  return out;
}