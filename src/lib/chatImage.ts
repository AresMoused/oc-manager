import type { Character } from "@/lib/types";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
import { appearanceOf, composeAppearancePrompt } from "@/lib/appearance";
import { runSavedComfyJob } from "@/lib/comfyConfig";
import { writeImagePrompt, resolveComfyPrompt, parseImageInserts } from "@/lib/imagePrompt";

function snapshotPrompt(c: Character): string {
  const list = c.prompts || [];
  const labeled = list.find((p) => /成熟|外观|默认|主/.test(p.label || ""));
  return (labeled || list[0])?.text || "";
}

function localPrompt(c: Character, extra = ""): string {
  const app = appearanceOf(c);
  const composed = composeAppearancePrompt(app, { extra, skipOutfit: false });
  const snap = snapshotPrompt(c);
  return composed && composed !== extra.trim() ? composed : [snap, extra].filter(Boolean).join(", ");
}

export async function generateCharacterStill(
  c: Character,
  extra = "",
  signal?: AbortSignal,
  source = "角色对话",
  llm?: {
    config: AiApiConfig;
    params: AiModelParams;
    history?: string;
    userLine?: string;
    body?: string;
    characters?: Character[];
  }
): Promise<{ urls: string[]; seed: number; prompt: string }> {
  const fallback = localPrompt(c, extra);
  let prompt = fallback;
  if (llm?.config) {
    const written = await writeImagePrompt({
      character: c,
      characters: llm.characters || [c],
      extra,
      scene: extra,
      body: llm.body || "",
      history: llm.history,
      userLine: llm.userLine || "",
      config: llm.config,
      params: llm.params,
      signal,
      fallback,
      source,
    });
    prompt = written.prompt || fallback;
  }
  const roster = llm?.characters?.length ? llm.characters : [c];
  prompt = resolveComfyPrompt(prompt, roster);
  if (!prompt.trim()) throw new Error(`${c.name} 还没有外观提示词`);
  const ov: Parameters<typeof runSavedComfyJob>[0] = { prompt_character: prompt, prompt_suffix: "" };
  const app = appearanceOf(c);
  if (app.negative) ov.negative_prompt = app.negative;
  return runSavedComfyJob(ov, signal, { source, note: `${c.name} 对话出图` });
}

/** 生图预设写 tags，每个 <imageN> 出一张图，挂在对话里（不插入正文）。 */
export async function illustrateReply(opts: {
  character: Character;
  characters?: Character[];
  body: string;
  history?: string;
  config: AiApiConfig;
  params: AiModelParams;
  signal?: AbortSignal;
  source?: string;
}): Promise<{ body: string; urls: string[] }> {
  const body = (opts.body || "").trim();
  if (!body || !opts.config.apiKey) return { body, urls: [] };
  const roster = opts.characters?.length ? opts.characters : [opts.character];
  const written = await writeImagePrompt({
    character: opts.character,
    characters: roster,
    body,
    history: opts.history,
    userLine: "",
    config: opts.config,
    params: opts.params,
    signal: opts.signal,
    fallback: "",
    source: opts.source || "正文插图",
  });
  const inserts = (written.inserts?.length ? written.inserts : parseImageInserts(written.raw, roster)).filter(
    (x) => x.prompt
  );
  if (!inserts.length) return { body, urls: [] };
  const app = appearanceOf(opts.character);
  const urls: string[] = [];
  for (const it of inserts) {
    const ov: Parameters<typeof runSavedComfyJob>[0] = { prompt_character: it.prompt, prompt_suffix: "" };
    if (app.negative) ov.negative_prompt = app.negative;
    const job = await runSavedComfyJob(ov, opts.signal, {
      source: opts.source || "正文插图",
      note: `${opts.character.name} 插图`,
    });
    for (const url of job.urls) urls.push(url);
  }
  return { body, urls };
}