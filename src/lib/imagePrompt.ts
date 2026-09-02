/** LLM writes the image prompt (智绘姬 正文/展示预设), then Comfy renders it. */

import type { Character } from "@/lib/types";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { completeChat } from "@/lib/aiConfig";
import { appearanceOf, composeAppearancePrompt, findOutfit, layerText } from "@/lib/appearance";
import { packForImage, type ContextPack } from "@/lib/contextPacks";
import { pushDebugLog } from "@/lib/debugLog";

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return String(text || "").replace(/\{\{([^}]+)\}\}/g, (full, k) => {
    const key = String(k).trim();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full;
  });
}

/** 智绘姬：把内容填进 <角色信息>…</角色信息> 这类标记，而不是只替换 {{变量}}。 */
export function fillMarkedBlocks(text: string, blocks: Record<string, string>): string {
  let s = String(text || "");
  for (const [tag, body] of Object.entries(blocks)) {
    if (!body.trim()) continue;
    const re = new RegExp(`(<${tag}>)([\\s\\S]*?)(</${tag}>)`, "gi");
    s = s.replace(re, `$1\n${body}\n$3`);
  }
  return s;
}

function layerLines(prefix: string, layer: { front: string; back: string }): string[] {
  const f = layer.front.trim();
  const b = layer.back.trim();
  if (!f && !b) return [];
  return [`${prefix}.front: ${f || "—"}`, b ? `${prefix}.back: ${b}` : ""].filter(Boolean);
}

/** 智绘姬 角色启用列表：分层字段 + 可调用 name + 全部服装。 */
export function characterAppearanceBlock(c: Character): string {
  const app = appearanceOf(c);
  const en = (app.nameEN || c.name).trim() || c.name;
  const cn = (app.nameCN || c.name).trim() || c.name;
  const outfits = app.outfits || [];
  const lines: string[] = [
    `可调用名称: ${en}`,
    `中文名: ${cn}`,
    `英文名: ${en}`,
    ...layerLines("facialFeatures", app.face),
    ...layerLines("upperBodySFW", app.upperSfw),
    ...layerLines("fullBodySFW", app.fullSfw),
    ...layerLines("upperBodyNSFW", app.upperNsfw),
    ...layerLines("fullBodyNSFW", app.fullNsfw),
    `调用示例: \${"name":"${en}","angle":"from front","upperBody":"sfw","lowerBody":"hidden"}$`,
    `\${"name":"${en}","angle":"from front","upperBody":"nsfw","lowerBody":"nsfw"}$`,
  ];
  if (outfits.length) {
    lines.push("", `可调用服装（共${outfits.length}套，须用宏调用，不要改衣服原文）:`);
    for (const o of outfits) {
      const oen = (o.nameEN || o.nameCN || o.id).trim();
      const ocn = (o.nameCN || o.nameEN || o.id).trim();
      lines.push(`- ${ocn} / ${oen} → \${"name":"${oen}","upperBody":"visible","lowerBody":"visible"}$`);
    }
    lines.push("", outfitBlockForChars([c]));
  }
  const snaps = c.prompts || [];
  if (snaps.length) {
    lines.push("提示词快照:");
    for (const p of snaps) {
      const text = (p.text || "").trim();
      if (!text) continue;
      lines.push(`- ${p.label || "(未命名)"}: ${text}`);
    }
  }
  return lines.filter((x) => x !== undefined).join("\n");
}

export function characterPromptDossier(c: Character): string {
  return [characterAppearanceBlock(c), outfitBlockForChars([c])].filter(Boolean).join("\n\n");
}

export function characterListBlock(chars: Character[]): string {
  return chars.map(characterAppearanceBlock).join("\n\n") || "（无角色）";
}

export function outfitBlockForChars(chars: Character[]): string {
  const lines: string[] = [];
  for (const c of chars) {
    const app = appearanceOf(c);
    for (const o of app.outfits) {
      const en = (o.nameEN || o.nameCN || o.id).trim();
      const cn = (o.nameCN || o.nameEN || o.id).trim();
      lines.push(`可调用名称: ${en}`);
      lines.push(`中文名: ${cn}`);
      lines.push(`英文名: ${en}`);
      lines.push(`所属角色: ${c.name}`);
      lines.push(...layerLines("upper", o.upper));
      lines.push(...layerLines("full", o.full));
      lines.push(
        `调用: \${"name":"${en}","upperBody":"visible","lowerBody":"visible"}$`
      );
      lines.push("");
    }
  }
  return lines.join("\n").trim() || "（无卡内服装）";
}

export function outfitListBlock(chars: Character[]): string {
  return outfitBlockForChars(chars);
}

export function expandImageMacros(text: string, chars: Character[]): string {
  return String(text || "").replace(/\$(\{[\s\S]*?\})\$?/g, (_, raw: string) => expandOneMacro(raw, chars));
}

export function resolveComfyPrompt(text: string, chars: Character[]): string {
  let s = expandImageMacros(text, chars);
  s = s.replace(/\$\{[\s\S]*?\}/g, "");
  s = s.replace(/\{Artist\}/gi, "");
  s = s.replace(/\s+,/g, ",").replace(/,(?:\s*,)+/g, ",").replace(/^,\s*|,\s*$/g, "");
  return s.replace(/\s+/g, " ").trim();
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/[_\s-]+/g, "");
}

function findCharByMacro(chars: Character[], name: string): Character | undefined {
  const n = name.trim().toLowerCase();
  const compact = normName(name);
  if (!n) return undefined;
  return (
    chars.find((c) => c.name.toLowerCase() === n) ||
    chars.find((c) => {
      const app = appearanceOf(c);
      return app.nameEN.toLowerCase() === n || app.nameCN.toLowerCase() === n;
    }) ||
    chars.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase())) ||
    chars.find((c) => {
      const app = appearanceOf(c);
      return (
        normName(app.nameEN) === compact ||
        normName(app.nameCN) === compact ||
        normName(c.name) === compact ||
        normName(app.nameEN).includes(compact) ||
        compact.includes(normName(app.nameEN))
      );
    })
  );
}

function findOutfitOwner(chars: Character[], name: string) {
  const n = name.trim().toLowerCase();
  for (const c of chars) {
    const hit = findOutfit(appearanceOf(c), name);
    if (
      hit &&
      (hit.nameCN.toLowerCase() === n ||
        hit.nameEN.toLowerCase() === n ||
        hit.nameEN.toLowerCase().includes(n) ||
        hit.nameCN.toLowerCase().includes(n))
    ) {
      return { c, outfit: hit };
    }
  }
  for (const c of chars) {
    const hit = findOutfit(appearanceOf(c), name);
    if (hit) return { c, outfit: hit };
  }
  return undefined;
}

function parseMacroObj(raw: string): {
  name?: string;
  angle?: string;
  upperBody?: string;
  lowerBody?: string;
} | null {
  const cleaned = raw.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
  try {
    return JSON.parse(cleaned) as {
      name?: string;
      angle?: string;
      upperBody?: string;
      lowerBody?: string;
    };
  } catch {
    const get = (k: string) =>
      cleaned.match(new RegExp(`${k}\\s*[:=]\\s*["']([^"']+)["']`, "i"))?.[1];
    const name = get("name");
    if (!name) return null;
    return {
      name,
      angle: get("angle"),
      upperBody: get("upperBody") || get("upper"),
      lowerBody: get("lowerBody") || get("lower"),
    };
  }
}

function expandOneMacro(raw: string, chars: Character[]): string {
  const o = parseMacroObj(raw);
  if (!o?.name) return "";
  const angle = /back/.test(String(o.angle || "")) ? "back" : "front";
  const upper = String(o.upperBody || "").toLowerCase();
  const lower = String(o.lowerBody || "").toLowerCase();
  const looksLikeChar = /^(sfw|nsfw|hidden)?$/.test(upper) && /sfw|nsfw/.test(upper + lower);
  if (!looksLikeChar && (upper === "visible" || lower === "visible" || (upper === "hidden" && lower === "hidden"))) {
    const hit = findOutfitOwner(chars, o.name);
    if (!hit) return "";
    const parts: string[] = [];
    if (upper !== "hidden") parts.push(layerText(hit.outfit.upper, angle));
    if (lower !== "hidden") parts.push(layerText(hit.outfit.full, angle));
    return parts.filter(Boolean).join(", ");
  }
  const c = findCharByMacro(chars, o.name);
  if (!c) {
    const hit = findOutfitOwner(chars, o.name);
    if (!hit) return "";
    const parts: string[] = [];
    if (upper !== "hidden") parts.push(layerText(hit.outfit.upper, angle));
    if (lower !== "hidden") parts.push(layerText(hit.outfit.full, angle));
    return parts.filter(Boolean).join(", ");
  }
  return composeAppearancePrompt(appearanceOf(c), {
    angle,
    upper: upper === "nsfw" ? "nsfw" : "sfw",
    lower: lower === "hidden" ? "hidden" : lower === "nsfw" ? "nsfw" : "sfw",
    skipOutfit: true,
  });
}

export function extractImagePrompt(raw: string, chars: Character[]): string {
  return parseImageInserts(raw, chars)[0]?.prompt || "";
}

const CJK_TALK =
  /所以|但是|需要注意|角色调用|原文是|并未指明|可调用|这是|应该使用|不能调用|注意规则|全裸时|画面中|须注意|二设|第二人称/;

function cjkRatio(s: string): number {
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const n = cjk + latin;
  return n ? cjk / n : 0;
}

/** 英文 comma tags / girl1 结构才算提示词，中文思考过程丢掉。 */
export function looksLikeImageTags(s: string): boolean {
  const t = String(s || "").trim();
  if (t.length < 8) return false;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  if (latin < 12) return false;
  if (cjkRatio(t) > 0.28) return false;
  if (CJK_TALK.test(t) && (t.match(/[\u4e00-\u9fff]/g) || []).length > 6) return false;
  return /[,:]/.test(t) || /(?:1girl|1boy|2girls|girl1|boy1)\b/i.test(t);
}

export function stripThinkBlocks(s: string): string {
  return String(s || "")
    .replace(/<(img)?think\b[^>]*>[\s\S]*?<\/(img)?think>/gi, "\n")
    .replace(/<(img)?think\b[^>]*>[\s\S]*/gi, "\n")
    .replace(/<(disclaimer|reason|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, "\n");
}

function pickTagChunk(s: string): string {
  const src = stripThinkBlocks(s);
  const hashed = [...src.matchAll(/image###([\s\S]*?)(?:###|$)/gi)].map((m) => m[1]!.trim());
  const hashedOk = hashed.find(looksLikeImageTags);
  if (hashedOk) return hashedOk;
  const ticks = [...src.matchAll(/`{1,3}([^`]+)`{1,3}/g)]
    .map((m) => m[1]!.trim())
    .filter(looksLikeImageTags);
  if (ticks.length) return ticks.join(", ");
  const girl = [...src.matchAll(/girl\d+\s+is\s+[\s\S]{0,120}\(girl\d+:[\s\S]*?\)[\s\S]{0,160}/gi)].map((m) =>
    m[0]!.trim()
  );
  if (girl.length && girl.every(looksLikeImageTags)) return girl.join(", ");
  const lines = src
    .split(/[\n。！？]/)
    .map((l) => l.trim())
    .filter(looksLikeImageTags);
  if (lines.length) return lines.join(", ");
  const dropped = src.replace(/[\u4e00-\u9fff][^,\n`]{0,24}/g, " ").replace(/\s+/g, " ").trim();
  return looksLikeImageTags(dropped) ? dropped : "";
}

/** 从 <image1>… / <image> / image### 抽出每张图的 tags。 */
export function parseImageInserts(raw: string, chars: Character[]): { regex: string; prompt: string }[] {
  const src = stripThinkBlocks(String(raw || ""));
  const numbered = [...src.matchAll(/<image(\d+)>([\s\S]*?)<\/image\1>/gi)].sort(
    (a, b) => Number(a[1]) - Number(b[1])
  );
  const wrapped = src.match(/<images>([\s\S]*?)<\/images>/i)?.[1] || src;
  const plain = [...wrapped.matchAll(/<image>([\s\S]*?)<\/image>/gi)].map((m) => m[1]!);
  const texts = numbered.length ? numbered.map((m) => m[2]!) : plain.length ? plain : [wrapped];
  const out: { regex: string; prompt: string }[] = [];
  const seen = new Set<string>();
  for (const t of texts) {
    const regex = (t.match(/regex::\s*(.+)/i)?.[1] || t.match(/regex[:：]\s*(.+)/i)?.[1] || "")
      .trim()
      .replace(/^\$\{|\}$/g, "")
      .trim();
    const chunk = pickTagChunk(t);
    const prompt = resolveComfyPrompt(chunk.replace(/\s+/g, " ").trim(), chars);
    if (!prompt || !looksLikeImageTags(prompt) || seen.has(prompt)) continue;
    seen.add(prompt);
    out.push({ regex, prompt });
  }
  if (!out.length) {
    const chunk = pickTagChunk(src);
    const prompt = resolveComfyPrompt(chunk.replace(/\s+/g, " ").trim(), chars);
    if (prompt && looksLikeImageTags(prompt)) out.push({ regex: "", prompt });
  }
  return out.slice(0, 4);
}

function packMessages(pack: ContextPack, vars: Record<string, string>): { messages: ChatMessage[]; slotted: boolean } {
  const markers: Record<string, string> = {
    角色信息: vars.角色启用列表 || "",
    角色启用列表: vars.角色启用列表 || "",
    通用角色启用列表: vars.通用角色启用列表 || vars.角色启用列表 || "",
    衣服信息: vars.衣服信息 || vars.通用服装启用列表 || "",
    服装启用列表: vars.通用服装启用列表 || "",
    通用服装启用列表: vars.通用服装启用列表 || "",
    需要配置插图的正文: vars.正文 || "",
    参考资料: vars.上下文 || "",
    可用绘图角色列表: vars.角色启用列表 || "",
  };
  const source = pack.entries.filter((e) => e.enabled && (e.triggerMode || "always") !== "trigger");
  const hadSlot = source.some((e) =>
    /<角色信息>|<衣服信息>|<角色启用列表>|<需要配置插图的正文>|<参考资料>|\{\{角色启用列表\}\}|\{\{通用角色启用列表\}\}|\{\{通用服装启用列表\}\}|\{\{正文\}\}/.test(
      e.content
    )
  );
  const messages = source.map((e) => ({
    role: e.role,
    content: fillMarkedBlocks(fillTemplate(e.content, vars), markers),
  }));
  return { messages, slotted: hadSlot };
}

export async function writeImagePrompt(opts: {
  character?: Character;
  characters?: Character[];
  extra?: string;
  scene?: string;
  /** 要插图的正文：必须是刚生成的回复，不要用玩家输入。 */
  body?: string;
  history?: string;
  userLine?: string;
  config: AiApiConfig;
  params: AiModelParams;
  signal?: AbortSignal;
  fallback?: string;
  source?: string;
}): Promise<{ prompt: string; raw: string; packName: string; inserts: { regex: string; prompt: string }[] }> {
  const chars = opts.characters?.length
    ? opts.characters
    : opts.character
      ? [opts.character]
      : [];
  const fallback = (opts.fallback || "").trim();
  if (!opts.config.apiKey) {
    if (fallback) return { prompt: fallback, raw: "", packName: "fallback", inserts: fallback ? [{ regex: "", prompt: fallback }] : [] };
    throw new Error("出图需要先在陪玩姬里填 API Key，用来写提示词");
  }
  const focus = opts.character ? [opts.character] : chars;
  const pack = packForImage();
  const charBlock = characterListBlock(focus);
  const outfitBlock = outfitListBlock(focus);
  const charName = opts.character?.name || "";
  const rawBody = (opts.body || "").trim();
  const body =
    charName && rawBody && !rawBody.startsWith("（本次角色是")
      ? `（本次角色是${charName}）\n${rawBody}`
      : rawBody;
  const vars: Record<string, string> = {
    上下文: opts.history || "",
    正文: body,
    场景: opts.scene || "",
    用户需求: opts.userLine || "",
    世界书触发: "",
    角色启用列表: charBlock,
    通用角色启用列表: charBlock,
    角色信息: charBlock,
    通用服装启用列表: outfitBlock,
    衣服信息: outfitBlock,
    服装启用列表: outfitBlock,
    "人设.name": opts.character?.name || chars[0]?.name || "",
    "用户.name": "用户",
    入画角色: opts.character?.name || "",
  };
  const { messages, slotted } = packMessages(pack, vars);
  if (!slotted && focus.length) {
    messages.push({
      role: "user",
      content: `入画角色完整提示词：\n${charBlock}\n\n衣服信息：\n${outfitBlock}`,
    });
  }
  messages.push({
    role: "user",
    content: `只输出提示词，禁止任何思考过程。整段回复必须是 <image1>…</image1><image2>…</image2>… 第一字是 <image1>。不要 imgthink、不要中文分析、不要解释。
角色分组：单人 girl1 is in the center of the image (girl1: appearance tags) [action]
双人 girl1 is standing on the left side of the image (girl1: 第一个角色的提示词) [action], girl2 is sitting on the right side of the image (girl2: 第二个角色的提示词) [action]
image### 里按这个结构写，不要把两个角色的 tag 混在一起。`,
  });
  const raw = await completeChat({
    config: opts.config,
    params: { ...opts.params, maxTokens: Math.max(opts.params.maxTokens || 4096, 8192) },
    messages,
    signal: opts.signal,
    logSource: opts.source || "出图提示词",
    logTitle: pack.name,
  });
  const inserts = parseImageInserts(raw, chars);
  const prompt = inserts[0]?.prompt || fallback;
  pushDebugLog({
    source: opts.source || "出图提示词",
    kind: "chat",
    title: `writeImagePrompt · ${pack.name}`,
    payload: { pack: pack.name, prompt: prompt.slice(0, 500), count: inserts.length, raw: raw.slice(0, 2000) },
  });
  if (!inserts.length && !fallback.trim()) {
    throw new Error(
      raw.trim()
        ? "生图预设有回复，但没解析到 <image1> / image###。打开日志看 reply。"
        : "生图预设空回复。推理模型常把字写在 reasoning 里或把 token 用完。已记下 reasoning/finish；可把 max tokens 调到 8192，或换非推理模型，或关掉流式。"
    );
  }
  return { prompt, raw, packName: pack.name, inserts };
}