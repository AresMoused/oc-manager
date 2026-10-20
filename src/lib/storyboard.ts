/**
 * Manga storyboard (漫画分镜 / ネーム) editor — data model + SVG renderer.
 *
 * A page is a flat list of editable elements, in the spirit of OpenKoma
 * (https://github.com/Reuben-Sun/OpenKoma, Apache-2.0): page → panels (frames)
 * + bubbles, each with a `kind` used for selection and an inspector. No code is
 * copied from OpenKoma; only the model/UX ideas are borrowed. Stick figures are
 * an addition of our own (joint skeleton + pose presets).
 *
 * Everything here is pure (no DOM) so the same SVG string is used for the
 * in-browser preview, SVG/PNG export and the node tests.
 */

// ================================================================ model

export const PAGE_W = 680;
export const PAGE_H = 1020;

export type FrameKind = "panel" | "featured" | "title";

export interface Frame {
  id: string;
  kind: FrameKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Border colour; defaults by kind (cyan panel / red featured & title) */
  color: string;
  /** Title box only: the displayed title text */
  text?: string;
}

export type BubbleStyle = "narration" | "speech" | "thought";
export type TextDirection = "vertical" | "horizontal";

export interface Bubble {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  style: BubbleStyle;
  direction: TextDirection;
  fontSize: number;
  /** Border colour */
  color: string;
  textColor: string;
  /** Speech / thought tail tip, absolute page coords */
  tailX: number;
  tailY: number;
}

export const JOINTS = [
  "head", "neck", "hip",
  "lElbow", "lHand", "rElbow", "rHand",
  "lKnee", "lFoot", "rKnee", "rFoot",
] as const;
export type JointName = (typeof JOINTS)[number];
/** Joint positions in local units: figure is ~100 tall, origin between the feet, y up = negative */
export type Skeleton = Record<JointName, [number, number]>;

export type FigurePose =
  | "standing" | "pointing" | "sitting" | "walking"
  | "handshake" | "hug" | "waving";
export type FigureStyle = "stick" | "box" | "bust" | "rough";

export interface Figure {
  id: string;
  /** Foot centre on the page */
  x: number;
  y: number;
  /** Height in page px for a standing figure */
  size: number;
  flip: boolean;
  pose: FigurePose;
  style: FigureStyle;
  color: string;
  joints: Skeleton;
}

/** Quick spec of a side panel; "自动排版" turns specs into frames/bubbles/figures */
export type PanelPose = "standing" | "pointing" | "handshake" | "closeup" | "group" | "sitting" | "walking" | "hug";

export interface StoryPanel {
  id: string;
  /** Each non-empty line becomes its own dialogue box */
  text: string;
  figures: number;
  pose: PanelPose;
}

export interface Storyboard {
  id: string;
  title: string;
  /** Free-text caption box for the featured (center) panel, e.g. name + age */
  caption: string;
  /** Monologue box in the featured panel */
  monologue: string;
  panels: StoryPanel[];
  frames: Frame[];
  bubbles: Bubble[];
  figures: Figure[];
  createdAt: string;
  updatedAt: string;
}

export const MAX_SIDE_PANELS = 8;

export const PANEL_POSE_OPTIONS: { value: PanelPose; label: string }[] = [
  { value: "standing", label: "站立 standing" },
  { value: "pointing", label: "指向 pointing" },
  { value: "walking", label: "行走 walking" },
  { value: "sitting", label: "坐 sitting" },
  { value: "handshake", label: "握手 handshake" },
  { value: "hug", label: "拥抱 hug" },
  { value: "closeup", label: "特写 close-up" },
  { value: "group", label: "群像 group" },
];
export const FIGURE_POSE_OPTIONS: { value: FigurePose; label: string }[] = [
  { value: "standing", label: "站立" },
  { value: "pointing", label: "指向" },
  { value: "waving", label: "挥手" },
  { value: "walking", label: "行走" },
  { value: "sitting", label: "坐" },
  { value: "handshake", label: "握手(单人)" },
  { value: "hug", label: "拥抱(单人)" },
];
export const FIGURE_STYLE_OPTIONS: { value: FigureStyle; label: string }[] = [
  { value: "stick", label: "火柴人" },
  { value: "box", label: "方块身" },
  { value: "bust", label: "胸像特写" },
  { value: "rough", label: "粗稿全身" },
];

export const COLOR = {
  title: "#e5322d",
  featured: "#e5322d",
  panel: "#3ee6ee",
  text: "#4ad66d",
  ink: "#222222",
};

function rid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  list.includes(v as T) ? (v as T) : d;

// ================================================================ skeleton presets

const BASE: Skeleton = {
  head: [0, -90], neck: [0, -79], hip: [0, -45],
  lElbow: [-9, -63], lHand: [-11, -47], rElbow: [9, -63], rHand: [11, -47],
  lKnee: [-5, -23], lFoot: [-7, 0], rKnee: [5, -23], rFoot: [7, 0],
};

/** Facing right (+x). Use `flip` for facing left. */
export const POSE_PRESETS: Record<FigurePose, Skeleton> = {
  standing: BASE,
  pointing: { ...BASE, rElbow: [14, -78], rHand: [26, -94] },
  waving: { ...BASE, rElbow: [14, -76], rHand: [16, -96] },
  walking: {
    ...BASE, head: [3, -89], neck: [2, -78],
    lElbow: [-6, -62], lHand: [-14, -50], rElbow: [10, -63], rHand: [16, -51],
    lKnee: [-6, -23], lFoot: [-16, 0], rKnee: [9, -24], rFoot: [12, 0],
  },
  sitting: {
    ...BASE, head: [0, -72], neck: [0, -61], hip: [0, -28],
    lElbow: [-4, -45], lHand: [8, -33], rElbow: [6, -45], rHand: [16, -33],
    lKnee: [18, -27], lFoot: [18, 0], rKnee: [22, -27], rFoot: [22, 0],
  },
  handshake: {
    ...BASE, head: [5, -89], neck: [3, -78],
    rElbow: [14, -60], rHand: [26, -55],
    lKnee: [-4, -23], lFoot: [-10, 0], rKnee: [5, -23], rFoot: [6, 0],
  },
  hug: {
    ...BASE, head: [7, -88], neck: [5, -77],
    lElbow: [14, -70], lHand: [26, -68], rElbow: [18, -64], rHand: [28, -62],
    lKnee: [-3, -23], lFoot: [-9, 0], rKnee: [5, -23], rFoot: [5, 0],
  },
};

function cloneSkel(s: Skeleton): Skeleton {
  const out = {} as Skeleton;
  for (const j of JOINTS) out[j] = [s[j][0], s[j][1]];
  return out;
}

export function newFigure(p: Partial<Figure> = {}): Figure {
  const pose = p.pose ?? "standing";
  return {
    id: rid(), x: PAGE_W / 2, y: 500, size: 120, flip: false, pose,
    style: "stick", color: COLOR.ink, ...p,
    joints: p.joints ? cloneSkel(p.joints) : cloneSkel(POSE_PRESETS[pose]),
  };
}

export function newBubble(p: Partial<Bubble> = {}): Bubble {
  const b: Bubble = {
    id: rid(), x: 300, y: 300, w: 44, h: 150, text: "台词", style: "narration",
    direction: "vertical", fontSize: 15, color: COLOR.text, textColor: COLOR.ink,
    tailX: 0, tailY: 0, ...p,
  };
  if (!p.tailX && !p.tailY) { b.tailX = b.x - 20; b.tailY = b.y + b.h + 30; }
  return b;
}

export function newFrame(p: Partial<Frame> = {}): Frame {
  const kind = p.kind ?? "panel";
  return {
    id: rid(), kind, x: 40, y: 40, w: 200, h: 200,
    color: kind === "panel" ? COLOR.panel : COLOR.featured, ...p,
  };
}

export function newPanel(p: Partial<StoryPanel> = {}): StoryPanel {
  return { id: rid(), text: "", figures: 1, pose: "standing", ...p };
}

export function newStoryboard(): Storyboard {
  const now = new Date().toISOString();
  const b: Storyboard = {
    id: rid(), title: "", caption: "", monologue: "",
    panels: [newPanel(), newPanel()], frames: [], bubbles: [], figures: [],
    createdAt: now, updatedAt: now,
  };
  return { ...b, ...autoLayout(b) };
}

// ================================================================ normalize

function normSkel(raw: unknown, pose: FigurePose): Skeleton {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<JointName, unknown>>;
  const out = cloneSkel(POSE_PRESETS[pose]);
  for (const j of JOINTS) {
    const v = src[j];
    if (Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(Number(n)))) {
      out[j] = [Number(v[0]), Number(v[1])];
    }
  }
  return out;
}

export function normalizeFigure(raw: unknown): Figure {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<Figure>;
  const pose = oneOf(f.pose, FIGURE_POSE_OPTIONS.map((o) => o.value), "standing");
  return {
    id: str(f.id) || rid(), x: num(f.x, PAGE_W / 2), y: num(f.y, 500),
    size: Math.min(1200, Math.max(10, num(f.size, 120))), flip: !!f.flip, pose,
    style: oneOf(f.style, FIGURE_STYLE_OPTIONS.map((o) => o.value), "stick"),
    color: str(f.color, COLOR.ink), joints: normSkel(f.joints, pose),
  };
}

export function normalizeBubble(raw: unknown): Bubble {
  const b = (raw && typeof raw === "object" ? raw : {}) as Partial<Bubble>;
  return {
    id: str(b.id) || rid(), x: num(b.x, 300), y: num(b.y, 300),
    w: Math.max(16, num(b.w, 44)), h: Math.max(16, num(b.h, 150)), text: str(b.text),
    style: oneOf(b.style, ["narration", "speech", "thought"] as const, "narration"),
    direction: oneOf(b.direction, ["vertical", "horizontal"] as const, "vertical"),
    fontSize: Math.min(72, Math.max(8, num(b.fontSize, 15))),
    color: str(b.color, COLOR.text), textColor: str(b.textColor, COLOR.ink),
    tailX: num(b.tailX, num(b.x, 300)), tailY: num(b.tailY, num(b.y, 300) + 180),
  };
}

export function normalizeFrame(raw: unknown): Frame {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<Frame>;
  const kind = oneOf(f.kind, ["panel", "featured", "title"] as const, "panel");
  return {
    id: str(f.id) || rid(), kind, x: num(f.x, 40), y: num(f.y, 40),
    w: Math.max(10, num(f.w, 200)), h: Math.max(10, num(f.h, 200)),
    color: str(f.color, kind === "panel" ? COLOR.panel : COLOR.featured),
    ...(typeof f.text === "string" ? { text: f.text } : {}),
  };
}

export function normalizePanel(raw: unknown): StoryPanel {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<StoryPanel>;
  return {
    id: str(p.id) || rid(), text: str(p.text),
    figures: Math.min(6, Math.max(0, Math.round(num(p.figures, 1)))),
    pose: oneOf(p.pose, PANEL_POSE_OPTIONS.map((o) => o.value), "standing"),
  };
}

export function normalizeStoryboard(raw: unknown): Storyboard {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Storyboard>;
  const now = new Date().toISOString();
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    id: str(s.id) || rid(), title: str(s.title), caption: str(s.caption),
    monologue: str(s.monologue),
    panels: arr(s.panels).slice(0, MAX_SIDE_PANELS).map(normalizePanel),
    frames: arr(s.frames).map(normalizeFrame),
    bubbles: arr(s.bubbles).map(normalizeBubble),
    figures: arr(s.figures).map(normalizeFigure),
    createdAt: str(s.createdAt, now), updatedAt: str(s.updatedAt, now),
  };
}

export function normalizeStoryboardList(raw: unknown): Storyboard[] {
  return Array.isArray(raw) ? raw.map(normalizeStoryboard) : [];
}

// ================================================================ text layout

const FONT =
  "'Noto Sans CJK SC','Noto Serif CJK SC','PingFang SC','Microsoft YaHei','Source Han Sans SC',sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Vertical presentation forms for punctuation that must rotate in tategaki */
const VERTICAL_FORMS: Record<string, string> = {
  "「": "﹁", "」": "﹂", "『": "﹃", "』": "﹄", "（": "︵", "）": "︶", "(": "︵", ")": "︶",
  "《": "︽", "》": "︾", "【": "︻", "】": "︼", "—": "︱", "…": "︙", "～": "≀", "~": "≀", "-": "︱",
};
/** Drawn in the upper-right quadrant of their cell */
const CORNER_PUNCT = new Set(["，", "。", "、", ",", "."]);
/** Never start a column / line with these (kinsoku) */
const NO_START = new Set(["，", "。", "、", ",", ".", "！", "？", "!", "?", "」", "』", "）", ")", "》", "】", "…", "；", "：", "·"]);

/** Break text into runs of at most `per` glyphs, hanging closing punctuation on the previous run */
export function breakRuns(text: string, per: number): string[][] {
  const out: string[][] = [];
  for (const para of text.split(/\n/)) {
    const chars = Array.from(para.replace(/[ \t\r]+/g, (m) => (m.includes(" ") ? " " : "")));
    if (!chars.length) continue;
    let cur: string[] | null = null;
    for (const ch of chars) {
      if (!cur || (cur.length >= per && !NO_START.has(ch))) {
        cur = [ch];
        out.push(cur);
      } else cur.push(ch);
    }
  }
  return out;
}

export interface TextLayout {
  /** Natural size needed (for auto-sizing) */
  w: number;
  h: number;
  svg: string;
}

/**
 * Lay text into the box (x,y,w,h). Vertical: top→bottom, columns right→left,
 * one glyph per cell (per-char layout rather than CSS writing-mode, so it
 * rasterizes identically in every browser and in canvas PNG export).
 */
export function layoutText(
  text: string, x: number, y: number, w: number, h: number,
  o: { direction: TextDirection; fontSize: number; color: string; pad?: number }
): TextLayout {
  const fs = o.fontSize;
  const pad = o.pad ?? 5;
  const parts: string[] = [];
  if (o.direction === "vertical") {
    const cell = fs * 1.12;
    const colW = fs * 1.25;
    const per = Math.max(1, Math.floor((h - pad * 2) / cell));
    const cols = breakRuns(text, per);
    const usedW = cols.length * colW;
    const startRight = x + w / 2 + usedW / 2; // centred horizontally
    cols.forEach((col, ci) => {
      const cx = startRight - colW * ci - colW / 2;
      col.forEach((ch, ri) => {
        const cy = y + pad + cell * ri + cell / 2;
        const corner = CORNER_PUNCT.has(ch);
        parts.push(
          `<text x="${(cx + (corner ? fs * 0.32 : 0)).toFixed(1)}" y="${(cy - (corner ? fs * 0.3 : 0)).toFixed(1)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${esc(o.color)}">${esc(VERTICAL_FORMS[ch] ?? ch)}</text>`
        );
      });
    });
    const maxLen = Math.max(0, ...cols.map((c) => c.length));
    return { w: usedW + pad * 2, h: maxLen * cell + pad * 2, svg: parts.join("") };
  }
  const lineH = fs * 1.3;
  const per = Math.max(1, Math.floor((w - pad * 2) / fs));
  const lines = breakRuns(text, per);
  const usedH = lines.length * lineH;
  const top = y + h / 2 - usedH / 2;
  lines.forEach((line, li) => {
    parts.push(
      `<text x="${(x + w / 2).toFixed(1)}" y="${(top + lineH * li + lineH / 2).toFixed(1)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${esc(o.color)}">${esc(line.join(""))}</text>`
    );
  });
  const maxLen = Math.max(0, ...lines.map((l) => l.length));
  return { w: maxLen * fs + pad * 2, h: usedH + pad * 2, svg: parts.join("") };
}

// ================================================================ element renderers

function f1(n: number) {
  return n.toFixed(1);
}

export function renderBubble(b: Bubble): string {
  const stroke = `stroke="${esc(b.color)}" stroke-width="1.6"`;
  let shape = "";
  if (b.style === "narration") {
    shape = `<rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" fill="#fff" ${stroke}/>`;
  } else {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = b.w / 2 + 8;
    const ry = b.h / 2 + 8;
    if (b.style === "speech") {
      // tail: triangle from two points on the ellipse toward the tip; drawn under the ellipse fill
      const ang = Math.atan2(b.tailY - cy, b.tailX - cx);
      const spread = 0.22;
      const p = (a: number) => `${f1(cx + Math.cos(a) * rx * 0.9)},${f1(cy + Math.sin(a) * ry * 0.9)}`;
      shape =
        `<polygon points="${p(ang - spread)} ${f1(b.tailX)},${f1(b.tailY)} ${p(ang + spread)}" fill="#fff" ${stroke} stroke-linejoin="round"/>` +
        `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#fff" ${stroke}/>` +
        // hide the tail's base line inside the bubble
        `<polygon points="${p(ang - spread)} ${f1(cx + Math.cos(ang) * rx * 0.75)},${f1(cy + Math.sin(ang) * ry * 0.75)} ${p(ang + spread)}" fill="#fff" stroke="none"/>`;
    } else {
      // thought: cloud-ish dashed ellipse + trailing circles toward the tip
      const dots = [0.75, 0.5, 0.28].map((t, i) => {
        const dx = cx + (b.tailX - cx) * (1 - t * 0.55) ;
        const dy = cy + (b.tailY - cy) * (1 - t * 0.55);
        return `<circle cx="${f1(dx)}" cy="${f1(dy)}" r="${3 + (2 - i) * 2}" fill="#fff" ${stroke}/>`;
      });
      shape =
        dots.join("") +
        `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#fff" ${stroke} stroke-dasharray="7 3"/>`;
    }
  }
  const t = layoutText(b.text, b.x, b.y, b.w, b.h, {
    direction: b.direction, fontSize: b.fontSize, color: b.textColor,
  });
  return `<g data-bubble="${esc(b.id)}">${shape}${t.svg}</g>`;
}

/** Map a local skeleton point to page coords */
export function jointToPage(f: Figure, j: JointName): [number, number] {
  const k = f.size / 100;
  const [lx, ly] = f.joints[j];
  return [f.x + (f.flip ? -lx : lx) * k, f.y + ly * k];
}

export function pageToJoint(f: Figure, px: number, py: number): [number, number] {
  const k = f.size / 100;
  const lx = (px - f.x) / k;
  return [Math.round((f.flip ? -lx : lx) * 10) / 10, Math.round(((py - f.y) / k) * 10) / 10];
}

/** Page-space bounding box of a figure */
export function figureBounds(f: Figure): { x: number; y: number; w: number; h: number } {
  if (f.style === "bust" || f.style === "rough") {
    const w = f.size * (f.style === "bust" ? 0.9 : 0.36);
    return { x: f.x - w / 2, y: f.y - f.size, w, h: f.size };
  }
  const k = f.size / 100;
  const pts = JOINTS.map((j) => jointToPage(f, j));
  const r = 11 * k;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - r;
  const y0 = Math.min(...ys) - r;
  return { x: x0, y: y0, w: Math.max(...xs) + r - x0, h: Math.max(...ys) + 2 - y0 };
}

function stickSvg(f: Figure): string {
  const k = f.size / 100;
  const P = (j: JointName) => jointToPage(f, j);
  const a = `fill="none" stroke="${esc(f.color)}" stroke-width="${f1(Math.max(1.2, Math.min(3, 1.4 * k + 0.4)))}" stroke-linecap="round" stroke-linejoin="round"`;
  const line = (...js: JointName[]) =>
    `<polyline points="${js.map((j) => P(j).map(f1).join(",")).join(" ")}" ${a}/>`;
  const [hx, hy] = P("head");
  const [nx, ny] = P("neck");
  const [px, py] = P("hip");
  const r = 11 * k;
  // neck joint drawn just below the head circle
  let torso = line("neck", "hip");
  if (f.style === "box") {
    const tw = 18 * k;
    const ang = Math.atan2(py - ny, px - nx) - Math.PI / 2;
    const ox = Math.cos(ang) * tw / 2;
    const oy = Math.sin(ang) * tw / 2;
    torso = `<polygon points="${f1(nx - ox)},${f1(ny - oy)} ${f1(nx + ox)},${f1(ny + oy)} ${f1(px + ox)},${f1(py + oy)} ${f1(px - ox)},${f1(py - oy)}" ${a}/>`;
  }
  return (
    `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(r)}" ${a}/>` +
    torso +
    line("neck", "lElbow", "lHand") +
    line("neck", "rElbow", "rHand") +
    line("hip", "lKnee", "lFoot") +
    line("hip", "rKnee", "rFoot")
  );
}

/** Big head with cross guide + shoulder block (close-up) */
function bustSvg(f: Figure): string {
  const { x, y, w, h } = figureBounds(f);
  const a = `fill="none" stroke="${esc(f.color)}" stroke-width="1.6"`;
  const r = w * 0.36;
  const cx = x + w * (f.flip ? 0.58 : 0.42);
  const cy = y + r + 2;
  return (
    `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" ${a}/>` +
    `<path d="M${f1(cx - r)} ${f1(cy + r * 0.05)} Q${f1(cx)} ${f1(cy + r * 0.3)} ${f1(cx + r)} ${f1(cy - r * 0.05)}" ${a}/>` +
    `<path d="M${f1(cx + r * 0.1)} ${f1(cy - r)} Q${f1(cx - r * 0.25)} ${f1(cy)} ${f1(cx - r * 0.05)} ${f1(cy + r)}" ${a}/>` +
    `<line x1="${f1(cx - r * 0.1)}" y1="${f1(cy + r)}" x2="${f1(cx - r * 0.15)}" y2="${f1(cy + r * 1.3)}" ${a}/>` +
    `<line x1="${f1(cx + r * 0.25)}" y1="${f1(cy + r * 0.95)}" x2="${f1(cx + r * 0.25)}" y2="${f1(cy + r * 1.25)}" ${a}/>` +
    `<polygon points="${f1(cx - r * 1.3)},${f1(cy + r * 1.6)} ${f1(cx + r * 1.1)},${f1(cy + r * 1.25)} ${f1(cx + r * 1.4)},${f1(y + h)} ${f1(cx - r * 1.1)},${f1(y + h)}" ${a}/>`
  );
}

/** Full-body rough: cross-guided head, box torso, cylinder arms, skirt, stick legs */
function roughSvg(f: Figure): string {
  const a = `fill="none" stroke="${esc(f.color)}" stroke-width="1.8" stroke-linejoin="round"`;
  const cx = f.x;
  const bottom = f.y;
  const H = f.size;
  const top = bottom - H;
  const r = H * 0.075;
  const hy = top + r;
  const neckB = hy + r + H * 0.02;
  const tw = H * 0.17;
  const tTop = neckB;
  const tBot = tTop + H * 0.18;
  const skirtBot = tBot + H * 0.17;
  const legW = Math.max(6, H * 0.019);
  const cyl = (x1: number, y1: number, x2: number, y2: number, rad: number) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const nx = Math.sin(ang) * rad;
    const ny = -Math.cos(ang) * rad;
    const deg = (ang * 180) / Math.PI;
    return (
      `<line x1="${f1(x1 + nx)}" y1="${f1(y1 + ny)}" x2="${f1(x2 + nx)}" y2="${f1(y2 + ny)}" ${a}/>` +
      `<line x1="${f1(x1 - nx)}" y1="${f1(y1 - ny)}" x2="${f1(x2 - nx)}" y2="${f1(y2 - ny)}" ${a}/>` +
      `<ellipse cx="${f1(x2)}" cy="${f1(y2)}" rx="${f1(rad * 0.45)}" ry="${f1(rad)}" transform="rotate(${deg.toFixed(1)} ${f1(x2)} ${f1(y2)})" ${a}/>`
    );
  };
  const arm = H * 0.004 + 4.5;
  return (
    `<circle cx="${f1(cx)}" cy="${f1(hy)}" r="${f1(r)}" ${a}/>` +
    `<path d="M${f1(cx - r)} ${f1(hy + r * 0.08)} Q${f1(cx)} ${f1(hy + r * 0.22)} ${f1(cx + r)} ${f1(hy - r * 0.05)}" ${a}/>` +
    `<path d="M${f1(cx + r * 0.05)} ${f1(hy - r)} Q${f1(cx - r * 0.12)} ${f1(hy)} ${f1(cx)} ${f1(hy + r)}" ${a}/>` +
    `<rect x="${f1(cx - 4)}" y="${f1(hy + r)}" width="8" height="${f1(neckB - hy - r)}" ${a}/>` +
    `<polygon points="${f1(cx - tw / 2)},${f1(tTop)} ${f1(cx + tw / 2)},${f1(tTop - 3)} ${f1(cx + tw / 2 + 2)},${f1(tBot)} ${f1(cx - tw / 2 + 2)},${f1(tBot)}" ${a}/>` +
    cyl(cx - tw / 2 - 4, tTop + 8, cx - tw / 2 - H * 0.028, tTop + H * 0.1, arm) +
    cyl(cx - tw / 2 - H * 0.028, tTop + H * 0.1, cx - tw / 2 + 2, tTop + H * 0.06, arm * 0.85) +
    cyl(cx + tw / 2 + 4, tTop + 6, cx + tw / 2 + H * 0.034, tTop + H * 0.1, arm) +
    cyl(cx + tw / 2 + H * 0.034, tTop + H * 0.1, cx + 2, tTop + H * 0.13, arm * 0.85) +
    `<polygon points="${f1(cx - tw / 2 + 2)},${f1(tBot)} ${f1(cx + tw / 2 + 2)},${f1(tBot)} ${f1(cx + tw * 0.8)},${f1(skirtBot)} ${f1(cx - tw * 0.8)},${f1(skirtBot)}" ${a}/>` +
    `<rect x="${f1(cx - tw * 0.32)}" y="${f1(skirtBot)}" width="${f1(legW)}" height="${f1(bottom - skirtBot)}" ${a}/>` +
    `<rect x="${f1(cx + tw * 0.32 - legW)}" y="${f1(skirtBot)}" width="${f1(legW)}" height="${f1(bottom - skirtBot)}" ${a}/>`
  );
}

export function renderFigure(f: Figure): string {
  const body = f.style === "bust" ? bustSvg(f) : f.style === "rough" ? roughSvg(f) : stickSvg(f);
  return `<g data-figure="${esc(f.id)}">${body}</g>`;
}

function renderFrame(fr: Frame): string {
  const sw = fr.kind === "panel" ? 2 : 2.4;
  let s = `<rect x="${f1(fr.x)}" y="${f1(fr.y)}" width="${f1(fr.w)}" height="${f1(fr.h)}" fill="#fff" stroke="${esc(fr.color)}" stroke-width="${sw}"/>`;
  if (fr.kind === "title") {
    const raw = (fr.text ?? "").trim();
    const title = raw ? `《${raw.replace(/^《|》$/g, "")}》` : "《未命名》";
    const len = Array.from(title).length;
    const fs = Math.max(11, Math.min(22, Math.floor((fr.w - 24) / Math.max(1, len))));
    s +=
      `<text x="${f1(fr.x + 10)}" y="${f1(fr.y + 24)}" font-size="15" fill="${esc(fr.color)}" font-family="sans-serif">[TITLE BOX]</text>` +
      `<text x="${f1(fr.x + fr.w / 2)}" y="${f1(fr.y + fr.h * 0.7)}" font-size="${fs}" text-anchor="middle" fill="${esc(fr.color)}" font-weight="600">${esc(title)}</text>`;
  }
  return s;
}

/**
 * Render the page. Paint order: panels → their figures (clipped to the panel
 * containing the figure's foot) → featured / title → bubbles on top.
 */
export function renderStoryboardSvg(board: Storyboard): string {
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="${esc(FONT)}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>`,
  ];
  const frames = board.frames;
  const order: FrameKind[] = ["panel", "featured", "title"];
  const clipFor = (f: Figure) =>
    frames.findIndex(
      (fr) => fr.kind !== "title" && f.x >= fr.x && f.x <= fr.x + fr.w && f.y - 4 >= fr.y && f.y - 4 <= fr.y + fr.h
    );
  for (const kind of order) {
    frames.forEach((fr, i) => {
      if (fr.kind !== kind) return;
      out.push(renderFrame(fr));
      if (kind === "title") return;
      out.push(`<clipPath id="fc${i}"><rect x="${f1(fr.x)}" y="${f1(fr.y)}" width="${f1(fr.w)}" height="${f1(fr.h)}"/></clipPath>`);
      const figs = board.figures.filter((f) => clipFor(f) === i);
      if (figs.length) out.push(`<g clip-path="url(#fc${i})">${figs.map(renderFigure).join("")}</g>`);
    });
  }
  // figures outside every frame are drawn unclipped
  out.push(board.figures.filter((f) => clipFor(f) < 0).map(renderFigure).join(""));
  out.push(board.bubbles.map(renderBubble).join(""));
  out.push(`</svg>`);
  return out.join("");
}

// ================================================================ auto layout

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Side panel rects in manga reading order (right column top→bottom, then left), staggered */
export function sidePanelRects(count: number): Rect[] {
  const n = Math.min(MAX_SIDE_PANELS, Math.max(0, count));
  const right = Math.ceil(n / 2);
  const left = n - right;
  const column = (k: number, x: number, w: number, y0: number, y1: number): Rect[] => {
    if (k <= 0) return [];
    const gap = 16;
    const h = (y1 - y0 - gap * (k - 1)) / k;
    return Array.from({ length: k }, (_, i) => ({ x, y: y0 + i * (h + gap), w, h }));
  };
  return [...column(right, 455, 210, 50, 1000), ...column(left, 15, 215, 42, 992)];
}

/** Natural-size a vertical narration bubble anchored at its top-right corner */
function fitBubble(text: string, right: number, top: number, maxH: number, p: Partial<Bubble> = {}): Bubble {
  const fs = p.fontSize ?? 15;
  const t = layoutText(text, 0, 0, 1000, maxH, { direction: "vertical", fontSize: fs, color: "#000" });
  const w = Math.max(fs + 12, t.w);
  const h = Math.max(fs + 12, t.h);
  return newBubble({ text, x: right - w, y: top, w, h, ...p });
}

function panelFigures(p: StoryPanel, r: Rect): Figure[] {
  const foot = r.y + r.h - 16;
  const base = Math.min(r.h * 0.62, 150);
  const n = p.figures;
  const at = (i: number, count: number) => r.x + r.w * (0.18 + (0.55 * (i + 0.5)) / Math.max(1, count));
  const out: Figure[] = [];
  switch (p.pose) {
    case "closeup":
      out.push(newFigure({ style: "bust", x: r.x + r.w * 0.38, y: r.y + r.h, size: r.h * 0.85, color: "#777777" }));
      break;
    case "handshake":
    case "hug": {
      const cx = r.x + r.w * 0.45;
      const gap = p.pose === "hug" ? base * 0.22 : base * 0.26;
      out.push(newFigure({ pose: p.pose, x: cx - gap, y: foot, size: base, style: "box" }));
      out.push(newFigure({ pose: p.pose, x: cx + gap, y: foot, size: base, style: "box", flip: true }));
      for (let i = 2; i < n; i++) out.push(newFigure({ x: r.x + 18 + (i - 2) * 22, y: foot, size: base * 0.6 }));
      break;
    }
    case "pointing": {
      if (n <= 0) break;
      out.push(newFigure({ pose: "pointing", x: r.x + r.w * 0.38, y: foot - r.h * 0.22, size: base * 0.95, style: "box" }));
      for (let i = 0; i < n - 1; i++) out.push(newFigure({ x: at(i, n - 1), y: foot, size: base * 0.5, style: "box" }));
      break;
    }
    default:
      for (let i = 0; i < n; i++) {
        const pose: FigurePose = p.pose === "sitting" ? "sitting" : p.pose === "walking" ? "walking" : "standing";
        const size = p.pose === "group" ? base * (i % 2 ? 0.65 : 0.95) : n > 3 ? base * 0.75 : base;
        out.push(newFigure({ pose, x: at(i, n), y: foot, size, style: "box" }));
      }
  }
  return out;
}

/** Build frames / bubbles / figures from the quick panel specs (overwrites manual edits). */
export function autoLayout(board: Storyboard): Pick<Storyboard, "frames" | "bubbles" | "figures"> {
  const frames: Frame[] = [];
  const bubbles: Bubble[] = [];
  const figures: Figure[] = [];
  const rects = sidePanelRects(board.panels.length);
  board.panels.slice(0, rects.length).forEach((p, i) => {
    const r = rects[i];
    frames.push(newFrame({ kind: "panel", ...r }));
    const lines = p.text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let right = r.x + r.w - 10;
    const maxH = r.h * 0.6;
    for (const [li, line] of lines.entries()) {
      const b = fitBubble(line, right, r.y + 12 + (li % 2) * 24, maxH);
      if (b.x < r.x + 4) break;
      b.tailX = b.x - 10;
      b.tailY = b.y + b.h + 30;
      bubbles.push(b);
      right = b.x - 10;
    }
    // figures go left of the dialogue boxes, or into the lower part if that strip is too narrow
    const free = right - r.x;
    const fr = free >= r.w * 0.45 ? { ...r, w: free } : { ...r, y: r.y + r.h * 0.3, h: r.h * 0.7 };
    figures.push(...panelFigures(p, p.pose === "closeup" ? r : fr));
  });
  const fx = 245, fy = 126, fw = 185, fh = 872;
  frames.push(newFrame({ kind: "featured", x: fx, y: fy, w: fw, h: fh }));
  figures.push(newFigure({ style: "rough", x: fx + fw / 2, y: fy + fh - 20, size: fh - 230, color: COLOR.featured }));
  if (board.monologue.trim()) {
    bubbles.push(fitBubble(board.monologue, fx + fw - 6, fy + 6, 13 * 15.7 + 10, { color: COLOR.featured, textColor: COLOR.featured, fontSize: 14 }));
  }
  if (board.caption.trim()) {
    bubbles.push(fitBubble(board.caption, fx - 3, fy + 555, 300, { color: COLOR.featured, textColor: COLOR.featured }));
  }
  frames.push(newFrame({ kind: "title", x: 223, y: 18, w: 305, h: 86, color: COLOR.title, text: board.title }));
  return { frames, bubbles, figures };
}

// ================================================================ AI draft

export const STORYBOARD_AI_SYSTEM = `你是漫画分镜(ネーム)助手。根据用户的故事梗概，为一页漫画设计分镜。
只输出 JSON，不要任何解释或代码块标记，格式：
{"title":"标题","caption":"中央大格的人物名牌，如 姓名　年龄","monologue":"中央大格内心独白(40字内)","panels":[{"text":"旁白或台词，多个对话框用换行分隔","figures":1,"pose":"standing"}]}
panels 4-6 个，按阅读顺序(右上→右下→左上→左下)。pose 只能是 standing/pointing/walking/sitting/handshake/hug/closeup/group。每个对话框 30 字以内。`;

/** Parse LLM output; tolerates ```json fences and surrounding prose. */
export function parseAiStoryboard(raw: string): Pick<Storyboard, "title" | "caption" | "monologue" | "panels"> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 输出中没有 JSON");
  const n = normalizeStoryboard({ ...JSON.parse(raw.slice(start, end + 1)), id: "tmp" });
  return { title: n.title, caption: n.caption, monologue: n.monologue, panels: n.panels };
}

/** Sample matching the reference page (《埃尔达馆的贴身小女仆》) */
export function sampleStoryboard(): Storyboard {
  const b = newStoryboard();
  b.title = "埃尔达馆的贴身小女仆";
  b.caption = "玛莉卡·埃尔达\u3000十五岁";
  b.monologue = "虽然不知道为什么像我这样的孩子能以这个好的条件被雇佣，但我一定会抓住这份幸运，好好工作的。";
  b.panels = [
    newPanel({ text: "爸爸，妈妈，我找到工作了。\n真是没想到，竟然会有某位贵族老爷雇佣我去做帮工。", figures: 1, pose: "walking" }),
    newPanel({ text: "在大宅里，我还得到了漂亮的衣服，\n同僚们也都对我很亲切。", figures: 2, pose: "standing" }),
    newPanel({ text: "主人温暖地对我说「从今天起你也是这个家的一员了」，\n我感到非常高兴。", figures: 2, pose: "handshake" }),
    newPanel({ text: "寄回家的钱请用在弟弟们的学费上。\n西尔，马鲁埃，波拉，要好好学习，以后让姐姐过上轻松的日子！", figures: 4, pose: "pointing" }),
    newPanel({ text: "主人看起来是一位非常温和的人。\n我被赋予了照顾少爷起居的重任。", figures: 2, pose: "group" }),
    newPanel({ text: "从今天开始我要在新天地努力了！", figures: 1, pose: "closeup" }),
  ];
  return { ...b, ...autoLayout(b) };
}
