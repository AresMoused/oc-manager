/** Browser ring-buffer of prompts sent by 陪玩姬 / 角色对话 / 抽卡姬. */

export type DebugLogSource = "陪玩姬" | "角色对话" | "抽卡姬" | "AI生成角色";
export type DebugLogKind = "chat" | "comfy" | "tool" | "error";

export interface DebugLogEntry {
  id: string;
  at: string;
  source: DebugLogSource | string;
  kind: DebugLogKind;
  title: string;
  payload: unknown;
}

const KEY = "oc-debug-logs-v1";
const MAX = 40;
const MAX_STR = 80000;

function cap(v: unknown, depth = 0): unknown {
  if (v == null) return v;
  if (typeof v === "string") return v.length > MAX_STR ? v.slice(0, MAX_STR) + `…(+${v.length - MAX_STR})` : v;
  if (typeof v !== "object") return v;
  if (depth > 6) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 80).map((x) => cap(x, depth + 1));
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o).slice(0, 60)) {
    if (/key|token|authorization|password/i.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = cap(val, depth + 1);
  }
  return out;
}

export function loadDebugLogs(): DebugLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function clearDebugLogs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function pushDebugLog(entry: Omit<DebugLogEntry, "id" | "at"> & { at?: string }) {
  if (typeof window === "undefined") return;
  const item: DebugLogEntry = {
    id: crypto.randomUUID(),
    at: entry.at || new Date().toISOString(),
    source: entry.source,
    kind: entry.kind,
    title: entry.title,
    payload: cap(entry.payload),
  };
  const next = [item, ...loadDebugLogs()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(0, 20)));
    } catch { /* quota */ }
  }
}