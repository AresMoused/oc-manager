"use client";

import {
  ContextEntry,
  ContextPreset,
  ContextRole,
} from "@/lib/aiConfig";

export function newId() {
  return crypto.randomUUID();
}

export function roleLabel(r: ContextRole) {
  return r === "system" ? "SYS" : r === "assistant" ? "AI" : "USR";
}

export function roleColor(r: ContextRole) {
  return r === "system"
    ? "bg-amber-700 text-amber-100"
    : r === "assistant"
      ? "bg-emerald-700 text-emerald-100"
      : "bg-blue-700 text-blue-100";
}

export function parsePresetImport(raw: string): ContextPreset[] {
  const data = JSON.parse(raw);
  const norm = (p: Partial<ContextPreset>): ContextPreset => ({
    id: p.id || newId(),
    name: p.name || "导入预设",
    updatedAt: p.updatedAt || new Date().toISOString(),
    entries: Array.isArray(p.entries)
      ? p.entries.map((e: Partial<ContextEntry>) => ({
          id: e.id || newId(),
          role: (e.role === "system" || e.role === "assistant"
            ? e.role
            : "user") as ContextRole,
          name: e.name || "条目",
          content: e.content || "",
          enabled: e.enabled !== false,
        }))
      : [],
  });
  if (Array.isArray(data)) return data.map(norm);
  if (data && typeof data === "object") {
    if (Array.isArray(data.presets)) return data.presets.map(norm);
    if (data.entries || data.name) return [norm(data)];
  }
  throw new Error("无法识别的预设格式");
}
