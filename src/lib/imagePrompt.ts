/** LLM writes the image prompt (智绘姬 正文/展示预设), then Comfy renders it. */

import type { Character } from "@/lib/types";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { completeChat } from "@/lib/aiConfig";
import { appearanceOf, appearanceSummary, composeAppearancePrompt } from "@/lib/appearance";
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
  return String(text || "").replace(/\$(\{[\s\S]*?\})\$/g, (_, raw: string) => {
    try {
      const o = JSON.parse(raw) as {
        name?: string;
        angle?: string;
        upperBody?: string;
        lowerBody?: string;
      };
      const name = String(o.name || "").toLowerCase();
      const angle = /back/.test(String(o.angle || "")) ? "back" : "front";
      const outfitChar = chars.find((c) =>
        appearanceOf(c).outfits.some(
          (x) =>
            x.nameCN.toLowerCase() === name ||
            x.nameEN.toLowerCase() === name
        )
      );
      if (outfitChar && (o.upperBody === "visible" || o.lowerBody === "visible")) {
        return composeAppearancePrompt(appearanceOf(outfitChar), {
          angle,
          skipOutfit: false,
          outfitHint: o.name,
        });
      }
      const c =
        chars.find((x) => {
          const app = appearanceOf(x);
          return (
            x.name.toLowerCase() === name ||
            app.nameEN.toLowerCase() === name ||
            app.nameCN.toLowerCase() === name
          );
        }) || chars[0];
      if (!c) return "";
      const upper = o.upperBody === "nsfw" ? "nsfw" : "sfw";
      const lower =
        o.lowerBody === "hidden" ? "hidden" : o.lowerBody === "nsfw" ? "nsfw" : "sfw";
      return composeAppearancePrompt(appearanceOf(c), {
        angle,
        upper,
        lower,
        skipOutfit: true,
      });
    } catch {
      return "";
    }
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
  return expandImageMacros(pick.replace(/\s+/g, " ").trim(), chars);
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