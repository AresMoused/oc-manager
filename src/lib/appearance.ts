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

function pickView(layer: ViewLayer, angle: ShotAngle): string {
  return (angle === "back" ? layer.back || layer.front : layer.front || layer.back).trim();
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

  parts.push(pickView(app.face, angle));
  parts.push(pickView(upper === "nsfw" ? app.upperNsfw : app.upperSfw, angle));
  if (lower !== "hidden") {
    parts.push(pickView(lower === "nsfw" ? app.fullNsfw : app.fullSfw, angle));
  }

  const outfit = skipOutfit ? undefined : findOutfit(app, opts.outfitHint || app.activeOutfitId);
  if (outfit) {
    parts.push(pickView(outfit.upper, angle));
    if (lower !== "hidden") parts.push(pickView(outfit.full, angle));
  }

  parts.push(extra);
  const scene = (outfit?.photoPrompt || app.photoPrompt || "").replace(/\$\{[\s\S]*?\}\$/g, "").trim();
  if (scene) parts.push(scene);

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