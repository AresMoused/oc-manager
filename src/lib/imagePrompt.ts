/** LLM writes the image prompt (智绘姬 正文/展示预设), then Comfy renders it. */

import type { Character } from "@/lib/types";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { completeChat } from "@/lib/aiConfig";
import { appearanceOf, appearanceSummary, composeAppearancePrompt, findOutfit, layerText } from "@/lib/appearance";
import { packForImage, type ContextPack } from "@/lib/contextPacks";
import { pushDebugLog } from "@/lib/debugLog";

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return String(text || "").replace(/\{\{([^}]+)\}\}/g, (_, k) => vars[String(k).trim()] ?? "");
}

export function characterListBlock(chars: Character[]): string {
  return chars
    .map((c) => {
      const app = appearanceOf(c);
      const en = app.nameEN || c.name;
      const composed = composeAppearancePrompt(app, { skipOutfit: true });
      return [
        `· ${c.name} / ${en}`,
        appearanceSummary(app),
        `face+body: ${composed || "(空)"}`,
        `宏示例: \${"name":"${en}","angle":"front","upperBody":"sfw","lowerBody":"hidden"}$`,
      ].join("\n");
    })
    .join("\n\n");
}

export function outfitListBlock(chars: Character[]): string {
  const lines: string[] = [];
  for (const c of chars) {
    const app = appearanceOf(c);
    for (const o of app.outfits) {
      lines.push(
        `· ${c.name} / ${o.nameCN || o.nameEN} → \${"name":"${o.nameEN || o.nameCN}","upperBody":"visible","lowerBody":"visible"}$`
      );
    }
  }
  return lines.join("\n") || "（无卡内服装）";
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
  const blocks = [...String(raw || "").matchAll(/image###([\s\S]*?)###/gi)].map((m) =>
    m[1]!.trim()
  );
  let pick = blocks[0] || "";
  if (!pick) {
    const cleaned = String(raw || "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<imgthink>[\s\S]*?<\/imgthink>/gi, "")
      .replace(/<disclaimer>[\s\S]*?<\/disclaimer>/gi, "")
      .trim();
    pick =
      cleaned
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 24 && /[a-z]/i.test(l) && l.includes(",")) || cleaned;
  }
  return resolveComfyPrompt(pick.replace(/\s+/g, " ").trim(), chars);
}

function packMessages(pack: ContextPack, vars: Record<string, string>): ChatMessage[] {
  return pack.entries
    .filter((e) => e.enabled)
    .map((e) => ({
      role: e.role,
      content: fillTemplate(e.content, vars),
    }));
}

export async function writeImagePrompt(opts: {
  character?: Character;
  characters?: Character[];
  extra?: string;
  scene?: string;
  history?: string;
  userLine?: string;
  config: AiApiConfig;
  params: AiModelParams;
  signal?: AbortSignal;
  fallback?: string;
  source?: string;
}): Promise<{ prompt: string; raw: string; packName: string }> {
  const chars = opts.characters?.length
    ? opts.characters
    : opts.character
      ? [opts.character]
      : [];
  const fallback = (opts.fallback || "").trim();
  if (!opts.config.apiKey) {
    if (fallback) return { prompt: fallback, raw: "", packName: "fallback" };
    throw new Error("出图需要先在陪玩姬里填 API Key，用来写提示词");
  }
  const pack = packForImage();
  const vars: Record<string, string> = {
    上下文: opts.history || "",
    正文: opts.scene || opts.extra || opts.userLine || "",
    用户需求: opts.userLine || opts.extra || "",
    角色启用列表: characterListBlock(chars),
    通用角色启用列表: characterListBlock(chars),
    通用服装启用列表: outfitListBlock(chars),
    "人设.name": opts.character?.name || chars[0]?.name || "",
    "用户.name": "用户",
  };
  const messages = packMessages(pack, vars);
  const raw = await completeChat({
    config: opts.config,
    params: { ...opts.params, maxTokens: Math.min(opts.params.maxTokens || 2048, 2048) },
    messages,
    signal: opts.signal,
    logSource: opts.source || "出图提示词",
    logTitle: pack.name,
  });
  const prompt = extractImagePrompt(raw, chars) || fallback;
  pushDebugLog({
    source: opts.source || "出图提示词",
    kind: "chat",
    title: `writeImagePrompt · ${pack.name}`,
    payload: { pack: pack.name, prompt: prompt.slice(0, 500), raw: raw.slice(0, 800) },
  });
  if (!prompt.trim()) throw new Error("陪玩姬没有写出可用提示词");
  return { prompt, raw, packName: pack.name };
}