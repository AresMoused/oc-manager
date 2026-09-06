/** Repair and parse model-generated character-card JSON. */

const SCALAR_KEYS = [
  "name",
  "gender",
  "age",
  "race",
  "height",
  "weight",
  "affiliation",
  "identity",
  "residence",
  "faction",
  "birthplace",
  "world",
  "sheetRole",
  "story",
] as const;

const STRUCTURED_KEYS = [
  "traits",
  "emotions",
  "happiness",
  "outward",
  "combat",
  "preferences",
  "timeline",
  "prompts",
  "appearance",
] as const;

function stripBomAndFences(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json|javascript|js)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

/** Models sometimes emit JS concatenation: "foo,"+"bar" */
function joinConcatenatedStrings(text: string): string {
  return text.replace(/"\s*\+\s*"/g, "");
}

function stripTrailingCommas(text: string): string {
  let prev = "";
  let next = text;
  while (prev !== next) {
    prev = next;
    next = next.replace(/,(\s*[}\]])/g, "$1");
  }
  return next;
}

/** Escape raw control characters that appear inside JSON strings. */
function escapeRawControlsInStrings(text: string): string {
  let out = "";
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 32) {
        out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

function repairModelJson(text: string): string {
  return escapeRawControlsInStrings(
    stripTrailingCommas(joinConcatenatedStrings(stripBomAndFences(text)))
  );
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function unwrapCharacter(obj: Record<string, unknown>): Record<string, unknown> {
  const nested = obj.character;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  const data = obj.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = (data as Record<string, unknown>).character;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  return obj;
}

function looksLikeCharacter(obj: Record<string, unknown>): boolean {
  return SCALAR_KEYS.some((k) => k in obj) || STRUCTURED_KEYS.some((k) => k in obj);
}

function sliceBalanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  return sliceBalanced(text, start);
}

function parseJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  const repaired = repairModelJson(trimmed);
  try {
    return JSON.parse(repaired);
  } catch {
    if (
      (repaired.startsWith("{") && repaired.endsWith("}")) ||
      (repaired.startsWith("[") && repaired.endsWith("]"))
    ) {
      return null;
    }
    return repaired.replace(/^["']|["']$/g, "");
  }
}

function extractFieldsFallback(text: string): Record<string, unknown> | null {
  const src = repairModelJson(text);
  const out: Record<string, unknown> = {};

  for (const key of SCALAR_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*`);
    const m = re.exec(src);
    if (!m || m.index === undefined) continue;
    const i = m.index + m[0].length;
    if (src[i] === '"') {
      let val = "";
      let escape = false;
      for (let j = i + 1; j < src.length; j++) {
        const ch = src[j];
        if (escape) {
          val += ch === "n" ? "\n" : ch === "r" ? "\r" : ch === "t" ? "\t" : ch;
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') break;
        val += ch;
      }
      if (val) out[key] = val;
    } else {
      const slice = src.slice(i);
      const end = slice.search(/[,}\n]/);
      const token = (end >= 0 ? slice.slice(0, end) : slice).trim();
      if (token) {
        const n = Number(token);
        out[key] = Number.isFinite(n) && token !== "" ? n : token.replace(/^["']|["']$/g, "");
      }
    }
  }

  for (const key of STRUCTURED_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*`);
    const m = re.exec(src);
    if (!m || m.index === undefined) continue;
    const i = m.index + m[0].length;
    const ch = src[i];
    if (ch !== "{" && ch !== "[") continue;
    const block = sliceBalanced(src, i);
    if (!block) continue;
    const parsed = parseJsonValue(block);
    if (parsed !== null) out[key] = parsed;
  }

  return Object.keys(out).length ? out : null;
}

function collectCandidates(text: string): string[] {
  const cleaned = stripBomAndFences(text);
  const repaired = repairModelJson(text);
  const fromClean = extractFirstObject(cleaned);
  const fromRepaired = extractFirstObject(repaired);
  const lastBrace = repaired.lastIndexOf("}");
  const firstBrace = repaired.indexOf("{");
  const naiveSlice =
    firstBrace >= 0 && lastBrace > firstBrace
      ? repaired.slice(firstBrace, lastBrace + 1)
      : null;
  return [repaired, cleaned, fromRepaired, fromClean, naiveSlice].filter(
    (s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i
  );
}

export function parseCharacterJson(text: string): Record<string, unknown> | null {
  if (!text || !text.trim()) return null;

  for (const candidate of collectCandidates(text)) {
    const obj = tryParseObject(candidate);
    if (obj) {
      const unwrapped = unwrapCharacter(obj);
      if (looksLikeCharacter(unwrapped)) return unwrapped;
    }
  }

  const fallback = extractFieldsFallback(text);
  if (fallback && looksLikeCharacter(fallback)) return fallback;
  return null;
}
