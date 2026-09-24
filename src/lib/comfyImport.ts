import type { ComfyParams } from "@/lib/comfyConfig";
import type { LoraTrigger, SelectedLora } from "@/lib/comfyLora";

export interface ComfyImportLora {
  name: string;
  strength?: number;
  clipStrength?: number;
  trigger?: string;
  active?: boolean;
}

/** Clipboard payload written by aresmoused.com/works. */
export interface ComfyImportPayload {
  kind: "oc-comfy-import";
  version: 1;
  title?: string;
  prompt_prefix?: string;
  prompt_character?: string;
  prompt_suffix?: string;
  negative_prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  sampler_name?: string;
  scheduler?: string;
  model?: string;
  loras?: ComfyImportLora[];
}

export function parseComfyImport(raw: string): ComfyImportPayload {
  const text = raw.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("找不到 JSON。请先在作品页点「复制到抽卡姬」。");
  const data = JSON.parse(text.slice(start, end + 1)) as Partial<ComfyImportPayload>;
  if (data.kind !== "oc-comfy-import") throw new Error("这份内容不是抽卡姬参数。");
  return data as ComfyImportPayload;
}

/** Lora Manager groups are separated by ",,". A single block stays one toggle. */
export function splitTriggerGroups(trigger: string): string[] {
  const text = trigger.trim();
  if (!text) return [];
  const parts = text.includes(",,") ? text.split(/\s*,,\s*/) : [text];
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function triggersFromImport(groups: string[], latest: string[]): LoraTrigger[] {
  if (latest.length) {
    const blob = groups.join("\n").toLowerCase();
    return latest.map((text) => ({
      text,
      active: !groups.length || blob.includes(text.toLowerCase()),
    }));
  }
  return groups.map((text) => ({ text, active: true }));
}

export function applyImportParams(
  current: ComfyParams,
  payload: ComfyImportPayload,
  opts: { lockSampling: boolean }
): ComfyParams {
  const next = { ...current };
  if (typeof payload.prompt_prefix === "string") next.prompt_prefix = payload.prompt_prefix;
  if (typeof payload.prompt_character === "string") next.prompt_character = payload.prompt_character;
  if (typeof payload.prompt_suffix === "string") next.prompt_suffix = payload.prompt_suffix;
  if (typeof payload.negative_prompt === "string") next.negative_prompt = payload.negative_prompt;
  if (typeof payload.seed === "number" && Number.isFinite(payload.seed)) next.seed = Math.floor(payload.seed);
  if (typeof payload.width === "number" && payload.width > 0) next.width = Math.round(payload.width);
  if (typeof payload.height === "number" && payload.height > 0) next.height = Math.round(payload.height);
  if (typeof payload.model === "string" && payload.model.trim()) next.MODEL_NAME = payload.model.trim();
  if (!opts.lockSampling) {
    if (typeof payload.steps === "number" && payload.steps > 0) next.steps = Math.round(payload.steps);
    if (typeof payload.cfg_scale === "number" && payload.cfg_scale > 0) next.cfg_scale = payload.cfg_scale;
    if (payload.sampler_name) next.sampler_name = payload.sampler_name;
    if (payload.scheduler) next.scheduler = payload.scheduler;
  }
  return next;
}

export function importLoraToSelected(
  lora: ComfyImportLora,
  triggers: LoraTrigger[]
): SelectedLora | null {
  const name = lora.name.trim();
  if (!name) return null;
  const strength = typeof lora.strength === "number" && Number.isFinite(lora.strength) ? lora.strength : 0.6;
  const clip = typeof lora.clipStrength === "number" && Number.isFinite(lora.clipStrength) ? lora.clipStrength : strength;
  return {
    modelName: name,
    fileName: name,
    folder: "",
    strength,
    clipStrength: clip,
    active: lora.active !== false,
    triggers,
  };
}
