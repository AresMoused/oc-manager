import type { Character } from "@/lib/types";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
import { appearanceOf, composeAppearancePrompt } from "@/lib/appearance";
import { runSavedComfyJob } from "@/lib/comfyConfig";
import { writeImagePrompt, resolveComfyPrompt } from "@/lib/imagePrompt";

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
      history: llm.history,
      userLine: llm.userLine || extra,
      config: llm.config,
      params: llm.params,
      signal,
      fallback,
      source,
    });
    prompt = written.prompt;
  }
  const roster = llm?.characters?.length ? llm.characters : [c];
  prompt = resolveComfyPrompt(prompt, roster);
  if (!prompt.trim()) throw new Error(`${c.name} 还没有外观提示词`);
  const ov: Parameters<typeof runSavedComfyJob>[0] = { prompt_character: prompt, prompt_suffix: "" };
  const app = appearanceOf(c);
  if (app.negative) ov.negative_prompt = app.negative;
  return runSavedComfyJob(ov, signal, { source, note: `${c.name} 对话出图` });
}