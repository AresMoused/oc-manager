import type { DndSpellPreset } from "./schema";
import raw from "./coreSpells.json";

/** 2024《玩家手册》核心法术。效果为规则摘要；完整介绍见各条 url。 */
export const DEFAULT_SPELL_PRESETS: DndSpellPreset[] = raw as DndSpellPreset[];

export function spellFromPreset(preset: DndSpellPreset): DndSpellPreset {
  return {
    ...preset,
    id: crypto.randomUUID(),
    prepared: preset.level === 0,
  };
}

export function mergeCoreSpellPresets(existing: DndSpellPreset[]): DndSpellPreset[] {
  const byName = new Map(existing.map((p) => [p.name.trim(), p]));
  const out: DndSpellPreset[] = [];
  const seen = new Set<string>();
  for (const def of DEFAULT_SPELL_PRESETS) {
    const cur = byName.get(def.name.trim());
    if (!cur) {
      out.push({ ...def });
      continue;
    }
    seen.add(def.name.trim());
    const next = { ...cur };
    if (!next.url && def.url) next.url = def.url;
    if ((!next.effect || next.effect.length < 80) && def.effect) next.effect = def.effect;
    out.push(next);
  }
  for (const p of existing) {
    if (!seen.has(p.name.trim())) out.push(p);
  }
  return out;
}
