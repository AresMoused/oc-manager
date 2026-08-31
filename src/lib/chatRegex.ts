/** SillyTavern-style regex scripts for prompt + display. */

export interface ChatRegex {
  id: string;
  name: string;
  find: string;
  replace: string;
  enabled: boolean;
  promptOnly: boolean;
  markdownOnly: boolean;
  incompatible?: boolean;
}

export function newRegex(): ChatRegex {
  return {
    id: crypto.randomUUID(),
    name: "新规则",
    find: "",
    replace: "",
    enabled: true,
    promptOnly: false,
    markdownOnly: true,
  };
}

function looksIncompatible(find: string, replace: string): boolean {
  const s = `${find}\n${replace}`;
  return /SillyTavern|window\.top|getContext\s*\(|eval\s*\(|document\.write/i.test(s);
}

export function parseFindRegex(find: string): RegExp | null {
  const raw = String(find || "").trim();
  if (!raw) return null;
  try {
    const wrapped = raw.match(/^\/([\s\S]*)\/([gimsuy]*)$/);
    if (wrapped) {
      const flags = wrapped[2] && wrapped[2].includes("g") ? wrapped[2] : `${wrapped[2] || ""}g`;
      return new RegExp(wrapped[1]!, flags);
    }
    return new RegExp(raw, "g");
  } catch {
    return null;
  }
}

export function regexFromSt(raw: unknown): ChatRegex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const find = String(o.findRegex || o.find || "");
  if (!find) return null;
  const replace = String(o.replaceString ?? o.replace ?? "");
  const incompatible = looksIncompatible(find, replace);
  return {
    id: String(o.id || crypto.randomUUID()),
    name: String(o.scriptName || o.name || "未命名正则"),
    find,
    replace,
    enabled: o.disabled === true || incompatible ? false : o.enabled !== false,
    promptOnly: !!o.promptOnly,
    markdownOnly: !!o.markdownOnly,
    incompatible: incompatible || undefined,
  };
}

export function collectStRegexes(data: unknown): ChatRegex[] {
  const out: ChatRegex[] = [];
  const seen = new Set<string>();
  const take = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const r = regexFromSt(item);
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };
  const walk = (node: unknown, depth: number) => {
    if (depth > 6 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      if (node.some((x) => x && typeof x === "object" && ("findRegex" in x || "scriptName" in x))) {
        take(node);
        return;
      }
      for (const x of node) walk(x, depth + 1);
      return;
    }
    const rec = node as Record<string, unknown>;
    if (rec.identifier === "regexes-bindings" && typeof rec.content === "string") {
      try {
        take(JSON.parse(rec.content));
      } catch {
        /* skip */
      }
    }
    for (const v of Object.values(rec)) walk(v, depth + 1);
  };
  walk(data, 0);
  return out;
}

export function applyRegexes(
  text: string,
  scripts: ChatRegex[] | undefined,
  where: "prompt" | "display"
): string {
  let s = String(text ?? "");
  for (const r of scripts || []) {
    if (!r.enabled || r.incompatible) continue;
    if (where === "prompt" && r.markdownOnly && !r.promptOnly) continue;
    if (where === "display" && r.promptOnly && !r.markdownOnly) continue;
    if (where === "prompt" && !r.promptOnly && r.markdownOnly) continue;
    const re = parseFindRegex(r.find);
    if (!re) continue;
    try {
      s = s.replace(re, r.replace ?? "");
    } catch {
      /* skip bad replace */
    }
  }
  return s;
}