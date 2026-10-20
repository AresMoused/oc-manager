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

/** Layer state shared by every element */
export interface LayerProps {
  /** Optional user label shown in the layers panel */
  name?: string;
  hidden?: boolean;
  /** Locked elements cannot be selected/dragged on the canvas (only via the layers panel) */
  locked?: boolean;
}

export interface Frame extends LayerProps {
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
  /**
   * Corner positions as ratios of the bounding box width (OpenKoma-style
   * `PanelShape`): top edge runs tl→tr at y, bottom edge bl→br at y+h.
   * Omitted = rectangle (backward compatible with older documents).
   */
  shape?: PanelShape;
}

/** Ratios 0..1 of the frame width for each corner's x; y is fixed by the top/bottom edge */
export interface PanelShape {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export const RECT_SHAPE: PanelShape = { tl: 0, tr: 1, br: 1, bl: 0 };
/** Minimum edge length as a ratio of width, so a panel can't collapse */
const MIN_EDGE = 0.08;

export type ShapePreset = "rect" | "trapezoid" | "trapezoidInv" | "slantLeft" | "slantRight";
export const SHAPE_PRESET_OPTIONS: { value: ShapePreset; label: string }[] = [
  { value: "rect", label: "矩形" },
  { value: "trapezoid", label: "梯形（上窄）" },
  { value: "trapezoidInv", label: "梯形（下窄）" },
  { value: "slantLeft", label: "左斜（平行四边形）" },
  { value: "slantRight", label: "右斜（平行四边形）" },
];

export function shapePreset(p: ShapePreset, k = 0.14): PanelShape {
  switch (p) {
    case "trapezoid": return { tl: k, tr: 1 - k, br: 1, bl: 0 };
    case "trapezoidInv": return { tl: 0, tr: 1, br: 1 - k, bl: k };
    case "slantLeft": return { tl: 0, tr: 1 - k, br: 1, bl: k };
    case "slantRight": return { tl: k, tr: 1, br: 1 - k, bl: 0 };
    default: return { ...RECT_SHAPE };
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Clamp ratios to [0,1] and keep each edge at least MIN_EDGE long and ordered */
export function normalizeShape(raw: unknown): PanelShape | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Record<keyof PanelShape, unknown>>;
  const g = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? clamp01(Number(v)) : d);
  let tl = g(r.tl, 0), tr = g(r.tr, 1), bl = g(r.bl, 0), br = g(r.br, 1);
  const fix = (a: number, b: number): [number, number] => {
    if (b - a >= MIN_EDGE) return [a, b];
    const c = Math.min(1 - MIN_EDGE / 2, Math.max(MIN_EDGE / 2, (a + b) / 2));
    return [c - MIN_EDGE / 2, c + MIN_EDGE / 2];
  };
  [tl, tr] = fix(tl, tr);
  [bl, br] = fix(bl, br);
  const out = { tl, tr, br, bl };
  return isRectShape(out) ? undefined : out;
}

export function isRectShape(s: PanelShape | undefined): boolean {
  return !s || (Math.abs(s.tl) < 1e-6 && Math.abs(s.tr - 1) < 1e-6 && Math.abs(s.br - 1) < 1e-6 && Math.abs(s.bl) < 1e-6);
}

export type Pt = [number, number];
export type Corner = keyof PanelShape;
export const CORNERS: Corner[] = ["tl", "tr", "br", "bl"];

/** Page-space polygon of a frame, clockwise tl→tr→br→bl */
export function framePolygon(f: Pick<Frame, "x" | "y" | "w" | "h" | "shape">): Pt[] {
  const s = f.shape ?? RECT_SHAPE;
  return [
    [f.x + f.w * s.tl, f.y],
    [f.x + f.w * s.tr, f.y],
    [f.x + f.w * s.br, f.y + f.h],
    [f.x + f.w * s.bl, f.y + f.h],
  ];
}

export function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInFrame(f: Frame, x: number, y: number): boolean {
  if (y < f.y || y > f.y + f.h) return false;
  return pointInPolygon(x, y, framePolygon(f));
}

/** Move one corner horizontally to page x (OpenKoma-style: corners slide along their edge) */
export function setFrameCorner(f: Frame, corner: Corner, px: number): Frame {
  const s = { ...(f.shape ?? RECT_SHAPE) };
  let v = clamp01((px - f.x) / Math.max(1, f.w));
  if (corner === "tl") v = Math.min(v, s.tr - MIN_EDGE);
  if (corner === "tr") v = Math.max(v, s.tl + MIN_EDGE);
  if (corner === "bl") v = Math.min(v, s.br - MIN_EDGE);
  if (corner === "br") v = Math.max(v, s.bl + MIN_EDGE);
  s[corner] = clamp01(v);
  const shape = normalizeShape(s);
  const next: Frame = { ...f };
  if (shape) next.shape = shape;
  else delete next.shape;
  return next;
}

/** Intersect the frame's top and bottom edges at ratio t (0 = left edge, 1 = right edge) */
function edgeAt(s: PanelShape, edge: "top" | "bottom", t: number): number {
  return edge === "top" ? s.tl + (s.tr - s.tl) * t : s.bl + (s.br - s.bl) * t;
}

/**
 * Split a frame left/right along a (possibly slanted) line. `top` / `bottom` are
 * positions along the top and bottom edges (0..1 of that edge), `gutter` the gap
 * in page px. Both halves keep the parent bounding box; their shapes encode the cut.
 */
export function splitFrameVertical(f: Frame, top = 0.55, bottom = 0.45, gutter = 12): [Frame, Frame] {
  const s = f.shape ?? RECT_SHAPE;
  const g = gutter / 2 / Math.max(1, f.w);
  const tx = edgeAt(s, "top", clamp01(top));
  const bx = edgeAt(s, "bottom", clamp01(bottom));
  const mk = (shape: PanelShape, id?: string): Frame => {
    const n = normalizeShape(shape);
    const fr: Frame = { ...f, id: id ?? rid() };
    if (n) fr.shape = n;
    else delete fr.shape;
    return fr;
  };
  return [
    mk({ tl: s.tl, tr: tx - g, br: bx - g, bl: s.bl }, f.id),
    mk({ tl: tx + g, tr: s.tr, br: s.br, bl: bx + g }),
  ];
}

/** Split a frame top/bottom with a horizontal gutter (edges stay straight in this model) */
export function splitFrameHorizontal(f: Frame, at = 0.5, gutter = 12): [Frame, Frame] {
  const s = f.shape ?? RECT_SHAPE;
  const hTop = Math.max(10, f.h * clamp01(at) - gutter / 2);
  const yBot = f.y + f.h * clamp01(at) + gutter / 2;
  const t1 = hTop / f.h;
  const t2 = (yBot - f.y) / f.h;
  // corner x on the slanted side edges at the cut heights
  const lx = (t: number) => s.tl + (s.bl - s.tl) * t;
  const rx = (t: number) => s.tr + (s.br - s.tr) * t;
  const up: Frame = { ...f, h: hTop, shape: normalizeShape({ tl: s.tl, tr: s.tr, br: rx(t1), bl: lx(t1) }) };
  const down: Frame = { ...f, id: rid(), y: yBot, h: f.y + f.h - yBot, shape: normalizeShape({ tl: lx(t2), tr: rx(t2), br: s.br, bl: s.bl }) };
  for (const fr of [up, down]) if (!fr.shape) delete fr.shape;
  return [up, down];
}

export type BubbleStyle = "narration" | "rounded" | "speech" | "thought" | "shout" | "wavy";
export type BubbleFill = "opaque" | "transparent";

export const BUBBLE_STYLE_OPTIONS: { value: BubbleStyle; label: string }[] = [
  { value: "narration", label: "矩形框" },
  { value: "rounded", label: "圆角框" },
  { value: "speech", label: "椭圆气泡(带尾巴)" },
  { value: "thought", label: "云朵/思考气泡" },
  { value: "shout", label: "爆炸/呐喊气泡" },
  { value: "wavy", label: "波浪旁白框" },
];
const BUBBLE_STYLES = BUBBLE_STYLE_OPTIONS.map((o) => o.value);
export type TextDirection = "vertical" | "horizontal";

/** Membership of a text box / figure in a panel group */
export interface GroupMember {
  /**
   * Id of the panel (frame) this element belongs to; "" = ungrouped (未分格).
   * Missing in older documents → assigned by polygon containment on load.
   */
  frameId?: string;
}

export interface Bubble extends LayerProps, GroupMember {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  style: BubbleStyle;
  /** opaque = white fill hides art behind; transparent = text floats over art */
  fill: BubbleFill;
  /** Draw the outline (mainly for transparent boxes: thin border vs none) */
  border: boolean;
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

export interface Figure extends LayerProps, GroupMember {
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
  /** Break the frame: draw above panel borders, unclipped */
  breakFrame: boolean;
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

function layerProps(raw: Partial<LayerProps>): LayerProps {
  const out: LayerProps = {};
  if (typeof raw.name === "string" && raw.name.trim()) out.name = raw.name.slice(0, 60);
  if (raw.hidden === true) out.hidden = true;
  if (raw.locked === true) out.locked = true;
  return out;
}

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
    style: "stick", color: COLOR.ink, breakFrame: false, ...p,
    joints: p.joints ? cloneSkel(p.joints) : cloneSkel(POSE_PRESETS[pose]),
  };
}

export function newBubble(p: Partial<Bubble> = {}): Bubble {
  const b: Bubble = {
    id: rid(), x: 300, y: 300, w: 44, h: 150, text: "台词", style: "narration",
    fill: "opaque", border: true, direction: "vertical", fontSize: 15, color: COLOR.text, textColor: COLOR.ink,
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
    color: str(f.color, COLOR.ink), breakFrame: f.breakFrame === true,
    joints: normSkel(f.joints, pose),
    ...layerProps(f),
  };
}

export function normalizeBubble(raw: unknown): Bubble {
  const b = (raw && typeof raw === "object" ? raw : {}) as Partial<Bubble>;
  return {
    id: str(b.id) || rid(), x: num(b.x, 300), y: num(b.y, 300),
    w: Math.max(16, num(b.w, 44)), h: Math.max(16, num(b.h, 150)), text: str(b.text),
    style: oneOf(b.style, BUBBLE_STYLES, "narration"),
    fill: oneOf(b.fill, ["opaque", "transparent"] as const, "opaque"),
    border: b.border !== false,
    direction: oneOf(b.direction, ["vertical", "horizontal"] as const, "vertical"),
    fontSize: Math.min(72, Math.max(8, num(b.fontSize, 15))),
    color: str(b.color, COLOR.text), textColor: str(b.textColor, COLOR.ink),
    tailX: num(b.tailX, num(b.x, 300)), tailY: num(b.tailY, num(b.y, 300) + 180),
    ...layerProps(b),
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
    ...(normalizeShape(f.shape) ? { shape: normalizeShape(f.shape) } : {}),
    ...layerProps(f),
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
  const out: Storyboard = {
    id: str(s.id) || rid(), title: str(s.title), caption: str(s.caption),
    monologue: str(s.monologue),
    panels: arr(s.panels).slice(0, MAX_SIDE_PANELS).map(normalizePanel),
    frames: arr(s.frames).map(normalizeFrame),
    bubbles: arr(s.bubbles).map(normalizeBubble),
    figures: arr(s.figures).map(normalizeFigure),
    createdAt: str(s.createdAt, now), updatedAt: str(s.updatedAt, now),
  };
  // explicit membership if valid, else containment (backward compatible with docs lacking frameId)
  const rawB = arr(s.bubbles) as { frameId?: unknown }[];
  const rawF = arr(s.figures) as { frameId?: unknown }[];
  const ids = new Set(out.frames.filter((f) => f.kind !== "title").map((f) => f.id));
  const pick = (raw: unknown, auto: () => string) =>
    typeof raw === "string" ? (raw === "" || ids.has(raw) ? raw : auto()) : auto();
  out.bubbles = out.bubbles.map((b, i) => ({ ...b, frameId: pick(rawB[i]?.frameId, () => containingFrameId(out.frames, "bubble", b)) }));
  out.figures = out.figures.map((f, i) => ({ ...f, frameId: pick(rawF[i]?.frameId, () => containingFrameId(out.frames, "figure", f)) }));
  return out;
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

/** Closed path tracing an ellipse with outward scallops (cloud) */
function cloudPath(cx: number, cy: number, rx: number, ry: number): string {
  const n = Math.max(8, Math.round((rx + ry) / 9));
  const pt = (a: number, k = 1) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    const [qx, qy] = pt((a0 + a1) / 2, 1.28);
    d += (i === 0 ? `M${f1(x0)} ${f1(y0)}` : "") + ` Q${f1(qx)} ${f1(qy)} ${f1(x1)} ${f1(y1)}`;
  }
  return d + "Z";
}

/** Spiky burst polygon around an ellipse (deterministic jitter) */
function burstPoints(cx: number, cy: number, rx: number, ry: number): string {
  const n = Math.max(12, Math.round((rx + ry) / 7));
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const jitter = 1 + 0.12 * Math.sin(i * 2.7);
    const k = i % 2 ? 0.92 : 1.32 * jitter;
    pts.push(`${f1(cx + Math.cos(a) * rx * k)},${f1(cy + Math.sin(a) * ry * k)}`);
  }
  return pts.join(" ");
}

/** Rectangle whose edges are drawn as small waves */
function wavyRectPath(x: number, y: number, w: number, h: number): string {
  const amp = 3.5;
  const seg = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / 14));
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    let d = "";
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const tm = (t0 + t1) / 2;
      const s = i % 2 ? 1 : -1;
      d += ` Q${f1(x0 + (x1 - x0) * tm + nx * amp * s)} ${f1(y0 + (y1 - y0) * tm + ny * amp * s)} ${f1(x0 + (x1 - x0) * t1)} ${f1(y0 + (y1 - y0) * t1)}`;
    }
    return d;
  };
  return `M${f1(x)} ${f1(y)}` + seg(x, y, x + w, y) + seg(x + w, y, x + w, y + h) + seg(x + w, y + h, x, y + h) + seg(x, y + h, x, y) + "Z";
}

export function renderBubble(b: Bubble): string {
  const opaque = b.fill === "opaque";
  const fill = opaque ? "#fff" : "none";
  const stroke = b.border ? `stroke="${esc(b.color)}" stroke-width="${opaque ? 1.6 : 1}"` : `stroke="none"`;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w / 2 + 8;
  const ry = b.h / 2 + 8;
  let shape = "";
  switch (b.style) {
    case "narration":
      shape = `<rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" fill="${fill}" ${stroke}/>`;
      break;
    case "rounded": {
      const r = Math.min(b.w, b.h) * 0.3;
      shape = `<rect x="${f1(b.x - 3)}" y="${f1(b.y - 3)}" width="${f1(b.w + 6)}" height="${f1(b.h + 6)}" rx="${f1(r)}" fill="${fill}" ${stroke}/>`;
      break;
    }
    case "wavy":
      shape = `<path d="${wavyRectPath(b.x - 3, b.y - 3, b.w + 6, b.h + 6)}" fill="${fill}" ${stroke}/>`;
      break;
    case "shout":
      shape = `<polygon points="${burstPoints(cx, cy, rx, ry)}" fill="${fill}" ${stroke} stroke-linejoin="miter"/>`;
      break;
    case "speech": {
      // tail: triangle from two points on the ellipse toward the tip; drawn under the ellipse
      const ang = Math.atan2(b.tailY - cy, b.tailX - cx);
      const spread = 0.22;
      const p = (a: number) => `${f1(cx + Math.cos(a) * rx * 0.9)},${f1(cy + Math.sin(a) * ry * 0.9)}`;
      shape =
        `<polygon points="${p(ang - spread)} ${f1(b.tailX)},${f1(b.tailY)} ${p(ang + spread)}" fill="${fill}" ${stroke} stroke-linejoin="round"/>` +
        `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" ${stroke}/>` +
        (opaque
          ? `<polygon points="${p(ang - spread)} ${f1(cx + Math.cos(ang) * rx * 0.75)},${f1(cy + Math.sin(ang) * ry * 0.75)} ${p(ang + spread)}" fill="#fff" stroke="none"/>`
          : "");
      break;
    }
    case "thought": {
      const dots = [0.75, 0.5, 0.28].map((t, i) => {
        const dx = cx + (b.tailX - cx) * (1 - t * 0.55);
        const dy = cy + (b.tailY - cy) * (1 - t * 0.55);
        return `<circle cx="${f1(dx)}" cy="${f1(dy)}" r="${3 + (2 - i) * 2}" fill="${fill}" ${stroke}/>`;
      });
      shape = dots.join("") + `<path d="${cloudPath(cx, cy, rx * 0.92, ry * 0.92)}" fill="${fill}" ${stroke}/>`;
      break;
    }
  }
  const t = layoutText(b.text, b.x, b.y, b.w, b.h, {
    direction: b.direction, fontSize: b.fontSize, color: b.textColor,
  });
  return `<g data-bubble="${esc(b.id)}" data-fill="${b.fill}">${shape}${t.svg}</g>`;
}

/** Bubble styles that have a draggable tail */
export function bubbleHasTail(style: BubbleStyle): boolean {
  return style === "speech" || style === "thought";
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

function polyAttr(pts: Pt[]): string {
  return pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");
}

function renderFrame(fr: Frame): string {
  const sw = fr.kind === "panel" ? 2 : 2.4;
  let s = isRectShape(fr.shape)
    ? `<rect x="${f1(fr.x)}" y="${f1(fr.y)}" width="${f1(fr.w)}" height="${f1(fr.h)}" fill="#fff" stroke="${esc(fr.color)}" stroke-width="${sw}"/>`
    : `<polygon points="${polyAttr(framePolygon(fr))}" fill="#fff" stroke="${esc(fr.color)}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
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
export function renderStoryboardSvg(input: Storyboard): string {
  const board: Storyboard = {
    ...input,
    frames: input.frames.filter((x) => !x.hidden),
    bubbles: input.bubbles.filter((x) => !isEffectivelyHidden(input, x)),
    figures: input.figures.filter((x) => !isEffectivelyHidden(input, x)),
  };
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="${esc(FONT)}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>`,
  ];
  const frames = board.frames;
  const order: FrameKind[] = ["panel", "featured", "title"];
  const inFrame = (x: number, y: number) =>
    frames.findIndex((fr) => fr.kind !== "title" && pointInFrame(fr, x, y));
  /** Panel a figure belongs to: the one containing its foot, else its bbox centre; -1 = unclipped */
  const clipFor = (f: Figure) => {
    if (f.breakFrame) return -1;
    // explicit group membership wins; "" = ungrouped → unclipped
    if (f.frameId !== undefined) return f.frameId ? frames.findIndex((fr) => fr.id === f.frameId) : -1;
    const byFoot = inFrame(f.x, f.y - 4);
    if (byFoot >= 0) return byFoot;
    const bb = figureBounds(f);
    return inFrame(bb.x + bb.w / 2, bb.y + bb.h / 2);
  };
  for (const kind of order) {
    frames.forEach((fr, i) => {
      if (fr.kind !== kind) return;
      out.push(renderFrame(fr));
      if (kind === "title") return;
      out.push(`<clipPath id="fc${i}"><polygon points="${polyAttr(framePolygon(fr))}"/></clipPath>`);
      const figs = board.figures.filter((f) => clipFor(f) === i);
      if (figs.length) out.push(`<g clip-path="url(#fc${i})">${figs.map(renderFigure).join("")}</g>`);
    });
  }
  // figures outside every frame, and "break the frame" figures, are drawn unclipped above all borders
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
    const frame = newFrame({ kind: "panel", ...r });
    frames.push(frame);
    const nb = bubbles.length;
    const nf = figures.length;
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
    for (let k = nb; k < bubbles.length; k++) bubbles[k].frameId = frame.id;
    for (let k = nf; k < figures.length; k++) figures[k].frameId = frame.id;
  });
  const fx = 245, fy = 126, fw = 185, fh = 872;
  const featured = newFrame({ kind: "featured", x: fx, y: fy, w: fw, h: fh });
  frames.push(featured);
  figures.push(newFigure({ style: "rough", x: fx + fw / 2, y: fy + fh - 20, size: fh - 230, color: COLOR.featured, frameId: featured.id }));
  if (board.monologue.trim()) {
    bubbles.push(fitBubble(board.monologue, fx + fw - 6, fy + 6, 13 * 15.7 + 10, { color: COLOR.featured, textColor: COLOR.featured, fontSize: 14, frameId: featured.id }));
  }
  if (board.caption.trim()) {
    // the caption hangs off the featured panel's left edge but belongs to it
    bubbles.push(fitBubble(board.caption, fx - 3, fy + 555, 300, { color: COLOR.featured, textColor: COLOR.featured, frameId: featured.id }));
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

// ================================================================ layers

export type LayerKind = "frame" | "bubble" | "figure";
export const LAYER_KEY = { frame: "frames", bubble: "bubbles", figure: "figures" } as const;

/** Default label for an element in the layers panel */
export function layerLabel(kind: LayerKind, el: Frame | Bubble | Figure): string {
  if (el.name) return el.name;
  if (kind === "frame") {
    const f = el as Frame;
    return f.kind === "title" ? `标题框 ${f.text ?? ""}`.trim() : f.kind === "featured" ? "中央大格" : "分格";
  }
  if (kind === "bubble") {
    const t = (el as Bubble).text.replace(/\s+/g, "");
    return `对话框「${Array.from(t).slice(0, 8).join("")}${Array.from(t).length > 8 ? "…" : ""}」`;
  }
  const g = el as Figure;
  const pose = FIGURE_POSE_OPTIONS.find((o) => o.value === g.pose)?.label ?? g.pose;
  const style = FIGURE_STYLE_OPTIONS.find((o) => o.value === g.style)?.label ?? g.style;
  return `${style}·${pose}`;
}

/**
 * Move an element one step within its kind's paint order. dir +1 = towards the front
 * (later in the array = painted on top), -1 = towards the back. Returns a new board.
 */
export function moveLayer(board: Storyboard, kind: LayerKind, id: string, dir: 1 | -1): Storyboard {
  const key = LAYER_KEY[kind];
  const list = [...(board[key] as { id: string }[])];
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return board;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...board, [key]: list } as Storyboard;
}

/** Move an element to an absolute index inside its kind (used by drag-reorder) */
export function moveLayerTo(board: Storyboard, kind: LayerKind, id: string, index: number): Storyboard {
  const key = LAYER_KEY[kind];
  const list = [...(board[key] as { id: string }[])];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return board;
  const [it] = list.splice(i, 1);
  list.splice(Math.max(0, Math.min(list.length, index)), 0, it);
  return { ...board, [key]: list } as Storyboard;
}

// ================================================================ JSON document

export const STORYBOARD_FORMAT = "oc-manager-storyboard";
export const STORYBOARD_FORMAT_VERSION = 1;

export function exportStoryboardJson(board: Storyboard): string {
  return JSON.stringify(
    { format: STORYBOARD_FORMAT, version: STORYBOARD_FORMAT_VERSION, exportedAt: new Date().toISOString(), storyboard: board },
    null,
    2
  );
}

/**
 * Validate and load a storyboard JSON document. Accepts the wrapped export format
 * or a bare storyboard object. The result gets a fresh id so importing never
 * overwrites an existing page. Throws a user-facing Error on invalid input.
 */
export function importStoryboardJson(text: string): Storyboard {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON 文件");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSON 顶层必须是对象");
  const d = data as { format?: unknown; version?: unknown; storyboard?: unknown };
  let raw: unknown = data;
  if ("format" in d) {
    if (d.format !== STORYBOARD_FORMAT) throw new Error(`不支持的格式：${String(d.format)}`);
    if (typeof d.version !== "number" || d.version > STORYBOARD_FORMAT_VERSION) {
      throw new Error(`不支持的版本：${String(d.version)}`);
    }
    raw = d.storyboard;
  }
  if (!raw || typeof raw !== "object") throw new Error("缺少 storyboard 数据");
  const r = raw as Partial<Storyboard>;
  const looksLike = ["frames", "bubbles", "figures", "panels"].some((k) => Array.isArray((r as Record<string, unknown>)[k]));
  if (!looksLike) throw new Error("文件中没有分格、对话框或人物数据");
  const now = new Date().toISOString();
  return { ...normalizeStoryboard(raw), id: rid(), updatedAt: now };
}

// ================================================================ panel groups

export type MemberKind = "bubble" | "figure";

/** Id of the topmost non-title panel containing the element's anchor point, or "" */
export function containingFrameId(frames: Frame[], kind: MemberKind, el: Bubble | Figure): string {
  let pts: Pt[];
  if (kind === "bubble") {
    const b = el as Bubble;
    pts = [[b.x + b.w / 2, b.y + b.h / 2]];
  } else {
    const f = el as Figure;
    const bb = figureBounds(f);
    pts = [[f.x, f.y - 4], [bb.x + bb.w / 2, bb.y + bb.h / 2]];
  }
  for (const [x, y] of pts) {
    for (let i = frames.length - 1; i >= 0; i--) {
      const fr = frames[i];
      if (fr.kind !== "title" && pointInFrame(fr, x, y)) return fr.id;
    }
  }
  return "";
}

/** The group frame of an element, if any */
export function groupFrame(board: Storyboard, el: GroupMember): Frame | undefined {
  return el.frameId ? board.frames.find((f) => f.id === el.frameId) : undefined;
}

/** Hidden by itself or by its group */
export function isEffectivelyHidden(board: Storyboard, el: LayerProps & GroupMember): boolean {
  return !!el.hidden || !!groupFrame(board, el)?.hidden;
}

/** Locked by itself or by its group */
export function isEffectivelyLocked(board: Storyboard, el: LayerProps & GroupMember): boolean {
  return !!el.locked || !!groupFrame(board, el)?.locked;
}

export interface LayerGroup {
  /** Frame id, or "" for the ungrouped bucket */
  id: string;
  frame?: Frame;
  bubbles: Bubble[];
  figures: Figure[];
}

/**
 * Groups for the layers panel: one per frame (front-most frame first), then
 * 未分格. Members keep their paint order (front-most first).
 */
export function layerGroups(board: Storyboard): LayerGroup[] {
  const ids = new Set(board.frames.map((f) => f.id));
  const key = (el: GroupMember) => (el.frameId && ids.has(el.frameId) ? el.frameId : "");
  const groups: LayerGroup[] = [...board.frames].reverse().map((frame) => ({
    id: frame.id,
    frame,
    bubbles: [...board.bubbles].reverse().filter((b) => key(b) === frame.id),
    figures: [...board.figures].reverse().filter((f) => key(f) === frame.id),
  }));
  groups.push({
    id: "",
    bubbles: [...board.bubbles].reverse().filter((b) => key(b) === ""),
    figures: [...board.figures].reverse().filter((f) => key(f) === ""),
  });
  return groups;
}

/** Explicitly move an element into a panel group ("" = ungrouped) */
export function setMemberGroup(board: Storyboard, kind: MemberKind, id: string, frameId: string): Storyboard {
  if (frameId && !board.frames.some((f) => f.id === frameId && f.kind !== "title")) return board;
  const key = LAYER_KEY[kind];
  return {
    ...board,
    [key]: (board[key] as (Bubble | Figure)[]).map((x) => (x.id === id ? { ...x, frameId } : x)),
  } as Storyboard;
}

/** After a canvas drop: re-assign membership by containment */
export function regroupByPosition(board: Storyboard, kind: MemberKind, id: string): Storyboard {
  const key = LAYER_KEY[kind];
  const el = (board[key] as (Bubble | Figure)[]).find((x) => x.id === id);
  if (!el) return board;
  const next = containingFrameId(board.frames, kind, el);
  return next === el.frameId ? board : setMemberGroup(board, kind, id, next);
}

/**
 * Reorder an element within its own group (paint order): swaps with the
 * nearest same-kind sibling of the same group. dir +1 = towards the front.
 */
export function moveInGroup(board: Storyboard, kind: MemberKind, id: string, dir: 1 | -1): Storyboard {
  const key = LAYER_KEY[kind];
  const list = [...(board[key] as (Bubble | Figure)[])];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return board;
  const g = list[i].frameId ?? "";
  for (let j = i + dir; j >= 0 && j < list.length; j += dir) {
    if ((list[j].frameId ?? "") === g) {
      [list[i], list[j]] = [list[j], list[i]];
      return { ...board, [key]: list } as Storyboard;
    }
  }
  return board;
}

/** Ids of the members of a panel group */
export function groupMembers(board: Storyboard, frameId: string): { bubbles: string[]; figures: string[] } {
  return {
    bubbles: board.bubbles.filter((b) => b.frameId === frameId).map((b) => b.id),
    figures: board.figures.filter((f) => f.frameId === frameId).map((f) => f.id),
  };
}

/** Split / delete keep membership valid: members of a removed frame become ungrouped */
export function pruneMembership(board: Storyboard): Storyboard {
  const ids = new Set(board.frames.filter((f) => f.kind !== "title").map((f) => f.id));
  const fix = <T extends GroupMember>(x: T): T => (x.frameId && !ids.has(x.frameId) ? { ...x, frameId: "" } : x);
  return { ...board, bubbles: board.bubbles.map(fix), figures: board.figures.map(fix) };
}
