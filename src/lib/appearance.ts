/** Layered appearance + outfits, compatible with 智绘姬 character export. */

import type { AppearanceProfile, Character, OutfitPreset, ViewLayer } from "@/lib/types";

export type ShotAngle = "front" | "back";
export type BodyRating = "sfw" | "nsfw";

export function emptyLayer(): ViewLayer {
  return { front: "", back: "" };
}

export function emptyAppearance(): AppearanceProfile {
  return {
    nameCN: "",
    nameEN: "",
    negative: "",
    face: emptyLayer(),
    upperSfw: emptyLayer(),
    fullSfw: emptyLayer(),
    upperNsfw: emptyLayer(),
    fullNsfw: emptyLayer(),
    outfits: [],
    activeOutfitId: "",
    photoPrompt: "1girl, solo, looking at viewer",
  };
}

export function normalizeAppearance(raw: unknown): AppearanceProfile {
  const d = emptyAppearance();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Partial<AppearanceProfile>;
  const layer = (v: unknown): ViewLayer => {
    if (!v || typeof v !== "object") return emptyLayer();
    const x = v as ViewLayer;
    return { front: String(x.front || ""), back: String(x.back || "") };
  };
  return {
    nameCN: String(o.nameCN || d.nameCN),
    nameEN: String(o.nameEN || d.nameEN),
    negative: String(o.negative || ""),
    face: layer(o.face),
    upperSfw: layer(o.upperSfw),
    fullSfw: layer(o.fullSfw),
    upperNsfw: layer(o.upperNsfw),
    fullNsfw: layer(o.fullNsfw),
    outfits: Array.isArray(o.outfits)
      ? o.outfits.map((f) => ({
          id: String(f.id || crypto.randomUUID()),
          nameCN: String(f.nameCN || ""),
          nameEN: String(f.nameEN || ""),
          upper: layer(f.upper),
          full: layer(f.full),
          photoPrompt: String(f.photoPrompt || ""),
        }))
      : [],
    activeOutfitId: String(o.activeOutfitId || ""),
    photoPrompt: String(o.photoPrompt || d.photoPrompt),
  };
}

export const APPEARANCE_PARTS = [
  { id: "face", label: "脸 / 五官" },
  { id: "upperSfw", label: "上身 SFW" },
  { id: "fullSfw", label: "下身/全身 SFW" },
  { id: "upperNsfw", label: "上身 NSFW" },
  { id: "fullNsfw", label: "下身/全身 NSFW" },
] as const;

export type AppearancePartId = (typeof APPEARANCE_PARTS)[number]["id"];

export function layerText(layer: ViewLayer, angle: ShotAngle): string {
  return (angle === "back" ? layer.back || layer.front : layer.front || layer.back).trim();
}

export function composeSelectedParts(
  app: AppearanceProfile,
  opts: { parts: AppearancePartId[]; angle?: ShotAngle; outfitId?: string }
): string {
  const angle: ShotAngle = opts.angle === "back" ? "back" : "front";
  const parts: string[] = [];
  for (const id of opts.parts) {
    const layer = app[id];
    if (layer && typeof layer === "object" && "front" in layer) {
      parts.push(layerText(layer, angle));
    }
  }
  const outfit = opts.outfitId ? app.outfits.find((o) => o.id === opts.outfitId) : undefined;
  if (outfit) {
    parts.push(layerText(outfit.upper, angle));
    parts.push(layerText(outfit.full, angle));
  }
  return uniqueTags(parts);
}

function uniqueTags(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    for (const bit of raw.split(",")) {
      const t = bit.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out.join(", ");
}

export function findOutfit(app: AppearanceProfile, hint: string): OutfitPreset | undefined {
  const h = hint.trim().toLowerCase();
  if (!h) return app.outfits.find((o) => o.id === app.activeOutfitId) || app.outfits[0];
  return (
    app.outfits.find((o) => o.id.toLowerCase() === h) ||
    app.outfits.find((o) => o.nameCN.toLowerCase() === h || o.nameEN.toLowerCase() === h) ||
    app.outfits.find(
      (o) =>
        o.nameCN.toLowerCase().includes(h) ||
        h.includes(o.nameCN.toLowerCase()) ||
        o.nameEN.toLowerCase().includes(h) ||
        h.includes(o.nameEN.toLowerCase())
    )
  );
}

const OUTFIT_OVERRIDE = /bikini|swimsuit|nude|naked|lingerie|比基尼|泳装|裸体|内衣/i;

export function composeAppearancePrompt(
  app: AppearanceProfile | undefined,
  opts: {
    angle?: ShotAngle;
    upper?: BodyRating;
    lower?: BodyRating | "hidden";
    outfitHint?: string;
    extra?: string;
    skipOutfit?: boolean;
  } = {}
): string {
  if (!app) return (opts.extra || "").trim();
  const angle: ShotAngle = opts.angle === "back" ? "back" : "front";
  const upper: BodyRating = opts.upper === "nsfw" ? "nsfw" : "sfw";
  const lower = opts.lower || "sfw";
  const extra = (opts.extra || "").trim();
  const skipOutfit = opts.skipOutfit || (OUTFIT_OVERRIDE.test(extra) && !opts.outfitHint);
  const parts: string[] = [];

  parts.push(layerText(app.face, angle));
  parts.push(layerText(upper === "nsfw" ? app.upperNsfw : app.upperSfw, angle));
  if (lower !== "hidden") {
    parts.push(layerText(lower === "nsfw" ? app.fullNsfw : app.fullSfw, angle));
  }

  const outfit = skipOutfit ? undefined : findOutfit(app, opts.outfitHint || app.activeOutfitId);
  if (outfit) {
    parts.push(layerText(outfit.upper, angle));
    if (lower !== "hidden") parts.push(layerText(outfit.full, angle));
  }

  parts.push(extra);
  return uniqueTags(parts);
}

export function appearanceSummary(app: AppearanceProfile | undefined): string {
  if (!app) return "（还没有分层外观）";
  const outfits = app.outfits.map((o) => o.nameCN || o.nameEN || o.id).join("、") || "无";
  return [
    `中文名 ${app.nameCN || "—"} / EN ${app.nameEN || "—"}`,
    `脸: ${(app.face.front || "空").slice(0, 80)}`,
    `上身SFW: ${(app.upperSfw.front || "空").slice(0, 60)}`,
    `服装 ${app.outfits.length} 套：${outfits}`,
    `当前服装：${findOutfit(app, app.activeOutfitId)?.nameCN || "未选"}`,
  ].join("\n");
}

function textField(v: unknown): string {
  const s = String(v ?? "");
  if (!s || s.startsWith("data:image") || s.length > 8000) return "";
  return s;
}

function layerFromZhi(front: unknown, back: unknown): ViewLayer {
  return { front: textField(front), back: textField(back) };
}

export function importZhiCharacterJson(
  raw: string,
  preferName?: string
): { appearance: AppearanceProfile; importedName: string } {
  const data = JSON.parse(raw) as {
    characters?: Record<string, Record<string, unknown>>;
    outfits?: Record<string, Record<string, unknown>>;
  };
  const chars = data.characters || {};
  const ids = Object.keys(chars);
  if (!ids.length) throw new Error("不是智绘姬角色管理 JSON（缺少 characters）");
  const prefer = (preferName || "").toLowerCase();
  const id =
    ids.find((k) => k.toLowerCase().includes(prefer) && prefer) ||
    ids.find((k) => {
      const c = chars[k]!;
      return (
        String(c.nameCN || "").toLowerCase() === prefer ||
        String(c.nameEN || "").toLowerCase() === prefer
      );
    }) ||
    ids[0]!;
  const c = chars[id]!;
  const outfitIds = Array.isArray(c.outfits) ? c.outfits.map(String) : [];
  const outfitsSrc = data.outfits || {};
  const outfits: OutfitPreset[] = outfitIds.map((oid) => {
    const o = outfitsSrc[oid] || {};
    return {
      id: oid,
      nameCN: textField(o.nameCN) || oid,
      nameEN: textField(o.nameEN),
      upper: layerFromZhi(o.upperBody, o.upperBodyBack),
      full: layerFromZhi(o.fullBody, o.fullBodyBack),
      photoPrompt: textField(o.photoPrompt),
    };
  });
  const appearance: AppearanceProfile = {
    nameCN: textField(c.nameCN),
    nameEN: textField(c.nameEN) || id,
    negative: textField(c.negativePrompt),
    face: layerFromZhi(c.facialFeatures, c.facialFeaturesBack),
    upperSfw: layerFromZhi(c.upperBodySFW, c.upperBodySFWBack),
    fullSfw: layerFromZhi(c.fullBodySFW, c.fullBodySFWBack),
    upperNsfw: layerFromZhi(c.upperBodyNSFW, c.upperBodyNSFWBack),
    fullNsfw: layerFromZhi(c.fullBodyNSFW, c.fullBodyNSFWBack),
    outfits,
    activeOutfitId: outfits[0]?.id || "",
    photoPrompt: textField(c.photoPrompt) || emptyAppearance().photoPrompt,
  };
  return { appearance, importedName: appearance.nameCN || appearance.nameEN || id };
}

export function appearanceOf(c: Character | undefined): AppearanceProfile {
  return normalizeAppearance(c?.appearance);
}

const FACE_RE = /hair|bang|sidelock|ponytail|twintail|braid|eye|iris|pupil|lash|brow|blush|mole|freckle|horn|ear|fang|tooth|makeup|lipstick|eyeliner|face|expression|smile|grin|skin tone|dark-skinned|pale skin|tan|头发|瞳|眼|刘海|角|耳|妆|表情/i;
const BODY_LOWER_RE = /thigh|leg|hip|ass|butt|feet|foot|knee|calf|腿|臀|足/i;
const BODY_RE = /breast|boob|chest|navel|waist|hip|thigh|leg|ass|butt|body|figure|slim|slender|petite|curvy|muscular|tall|midriff|collarbone|shoulder|arm|abs|skin|胸|腰|腿|身材|锁骨/i;
const NSFW_RE = /nude|naked|nipple|pussy|penis|areola|uncensored|nsfw|裸体/i;
const CLOTH_LOWER_RE = /skirt|pants|shorts|jeans|boots|heels|shoes|pantyhose|stockings|thighhigh|garter|dress|gown|robe|裙|裤|靴|袜/i;
const CLOTH_RE = /dress|skirt|shirt|blouse|jacket|coat|cape|armor|bikini|lingerie|bra|panties|underwear|boots|heels|shoes|gloves|hat|cap|crown|ribbon|bow|pantyhose|stockings|thighhighs|leotard|kimono|uniform|hoodie|sweater|pants|shorts|jeans|choker|necklace|earring|bracelet|cloak|robe|veil|mask|belt|corset|garter|apron|scarf|tie|top|bodysuit|harness|collar|裙|衣|靴|袜|甲|袍|帽|手套|内衣/i;
const SKIP_RE = /^(1girl|2girls|solo|looking at viewer|masterpiece|best quality|absurdres|highres|newest)$/i;

function joinLayerTags(tags: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.join(", ");
}

export function splitPromptLayers(text: string): {
  face: string;
  upperSfw: string;
  fullSfw: string;
  upperNsfw: string;
  fullNsfw: string;
  outfitUpper: string;
  outfitFull: string;
} {
  const face: string[] = [];
  const upper: string[] = [];
  const full: string[] = [];
  const nsfwU: string[] = [];
  const nsfwF: string[] = [];
  const clothU: string[] = [];
  const clothF: string[] = [];
  for (const raw of String(text || "").split(/,/)) {
    const t = raw.trim();
    if (!t || SKIP_RE.test(t)) continue;
    if (NSFW_RE.test(t)) {
      (BODY_LOWER_RE.test(t) ? nsfwF : nsfwU).push(t);
    } else if (CLOTH_RE.test(t)) {
      (CLOTH_LOWER_RE.test(t) ? clothF : clothU).push(t);
    } else if (FACE_RE.test(t)) {
      face.push(t);
    } else if (BODY_RE.test(t)) {
      (BODY_LOWER_RE.test(t) ? full : upper).push(t);
    } else {
      face.push(t);
    }
  }
  return {
    face: joinLayerTags(face),
    upperSfw: joinLayerTags(upper),
    fullSfw: joinLayerTags(full),
    upperNsfw: joinLayerTags(nsfwU),
    fullNsfw: joinLayerTags(nsfwF),
    outfitUpper: joinLayerTags(clothU),
    outfitFull: joinLayerTags(clothF),
  };
}

/** Map character.prompts snapshots into layered appearance + outfits. */
export function fillAppearanceFromPrompts(c: Character, labelHint = ""): AppearanceProfile {
  const prompts = c.prompts || [];
  if (!prompts.length) throw new Error(`${c.name} 没有旧提示词快照`);
  const hint = labelHint.trim().toLowerCase();
  const picked = hint
    ? prompts.filter(
        (p) =>
          (p.label || "").toLowerCase().includes(hint) ||
          p.text.toLowerCase().includes(hint)
      )
    : prompts;
  const use = picked.length ? picked : prompts;
  const next = normalizeAppearance(c.appearance);
  if (!next.nameCN) next.nameCN = c.name;
  if (!next.nameEN) next.nameEN = c.name;

  const layers = splitPromptLayers(use.map((p) => p.text).join(", "));
  if (layers.face) next.face.front = layers.face;
  if (layers.upperSfw) next.upperSfw.front = layers.upperSfw;
  if (layers.fullSfw) next.fullSfw.front = layers.fullSfw;
  if (layers.upperNsfw) next.upperNsfw.front = layers.upperNsfw;
  if (layers.fullNsfw) next.fullNsfw.front = layers.fullNsfw;

  let madeOutfit = false;
  for (const p of use) {
    const cloth = splitPromptLayers(p.text);
    if (!cloth.outfitUpper && !cloth.outfitFull) continue;
    const nameCN = (p.label || "默认服装").trim();
    let hit = next.outfits.find((o) => o.nameCN === nameCN);
    if (!hit) {
      hit = {
        id: crypto.randomUUID(),
        nameCN,
        nameEN: "",
        upper: emptyLayer(),
        full: emptyLayer(),
        photoPrompt: "",
      };
      next.outfits.push(hit);
    }
    if (cloth.outfitUpper) hit.upper.front = cloth.outfitUpper;
    if (cloth.outfitFull) hit.full.front = cloth.outfitFull;
    next.activeOutfitId = hit.id;
    madeOutfit = true;
  }
  if (!madeOutfit && (layers.outfitUpper || layers.outfitFull)) {
    const hit: OutfitPreset = {
      id: crypto.randomUUID(),
      nameCN: "默认服装",
      nameEN: "",
      upper: { front: layers.outfitUpper, back: "" },
      full: { front: layers.outfitFull, back: "" },
      photoPrompt: "",
    };
    next.outfits.push(hit);
    next.activeOutfitId = hit.id;
  }
  return next;
}