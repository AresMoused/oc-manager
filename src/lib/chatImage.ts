import type { Character } from "@/lib/types";
import { appearanceOf, composeAppearancePrompt } from "@/lib/appearance";
import { runSavedComfyJob } from "@/lib/comfyConfig";

function snapshotPrompt(c: Character): string {
  const list = c.prompts || [];
  const labeled = list.find((p) => /成熟|外观|默认|主/.test(p.label || ""));
  return (labeled || list[0])?.text || "";
}

export async function generateCharacterStill(
  c: Character,
  extra = "",
  signal?: AbortSignal,
  source = "角色对话"
): Promise<{ urls: string[]; seed: number; prompt: string }> {
  const app = appearanceOf(c);
  const composed = composeAppearancePrompt(app, { extra, skipOutfit: false });
  const snap = snapshotPrompt(c);
  const prompt = composed && composed !== extra.trim() ? composed : [snap, extra].filter(Boolean).join(", ");
  if (!prompt.trim()) throw new Error(`${c.name} 还没有外观提示词`);
  const ov: Parameters<typeof runSavedComfyJob>[0] = { prompt_character: prompt, prompt_suffix: "" };
  if (app.negative) ov.negative_prompt = app.negative;
  return runSavedComfyJob(ov, signal, { source, note: `${c.name} 对话出图` });
}