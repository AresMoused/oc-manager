"use client";

import type { BuilderData } from "@/lib/promptBuilder";
import { normalizeBuilderData, saveCachedBuilder } from "@/lib/promptBuilder";
import {
  buildEnabledBuilderData,
  composeFromSections,
  fetchLexiconCatalog,
  fetchLexiconList,
  loadFixed,
  loadLocalLists,
  loadLocked,
  loadSelected,
  pickRandomSelected,
  resolveEnabledIds,
  saveSelected,
} from "@/lib/lexicon";

export async function loadLexiconBuilder(): Promise<BuilderData | null> {
  try {
    const cached = localStorage.getItem("oc-lexicon-runtime-builder");
    if (cached) {
      const parsed = JSON.parse(cached) as BuilderData;
      if (parsed?.sections?.length) return parsed;
    }
  } catch { /* ignore */ }
  try {
    const { index, defaultEnabled } = await fetchLexiconCatalog();
    const locals = loadLocalLists();
    const allIds = [
      ...index.categories.flatMap((c) => c.lists.map((l) => l.id)),
      ...locals.map((l) => l.id),
    ];
    const enabled = resolveEnabledIds(allIds, defaultEnabled);
    if (!enabled.length) return null;
    const data = await buildEnabledBuilderData(enabled, loadFixed(index.fixed || "1girl, "));
    if (data.sections.length) {
      try { localStorage.setItem("oc-lexicon-runtime-builder", JSON.stringify(data)); } catch { /* ignore */ }
      return data;
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch("/prompts/original_character.json", { cache: "force-cache" });
    if (res.ok) {
      const source = normalizeBuilderData(await res.json());
      saveCachedBuilder(source);
      return source;
    }
  } catch { /* ignore */ }
  return null;
}

export function rollRandomCharacter(data: BuilderData | null): string | null {
  if (!data || !data.sections.length) return null;
  const selected = pickRandomSelected(
    data.sections,
    loadLocked(),
    loadSelected()
  );
  saveSelected(selected);
  return composeFromSections(
    data.fixed || "1girl, ",
    data.sections,
    selected
  ).trim() || null;
}

/** Roll one item from catalog lists matching a category/list hint (e.g. BDSM). Prefer enabled 抽卡姬 lists. */
export async function rollLexiconHint(hint: string): Promise<{
  tags: string;
  name: string;
  listLabel: string;
  categoryLabel: string;
} | null> {
  const q = hint.trim().toLowerCase();
  if (!q) return null;
  const { index, defaultEnabled } = await fetchLexiconCatalog();
  const locals = loadLocalLists();
  const allIds = [
    ...index.categories.flatMap((c) => c.lists.map((l) => l.id)),
    ...locals.map((l) => l.id),
  ];
  const enabled = new Set(resolveEnabledIds(allIds, defaultEnabled));
  const hits: { listId: string; listLabel: string; categoryLabel: string }[] = [];
  for (const cat of index.categories) {
    const catHit = cat.label.toLowerCase().includes(q) || cat.id.toLowerCase().includes(q);
    for (const l of cat.lists) {
      const listHit =
        l.label.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.filterTags || []).some((t) => t.toLowerCase().includes(q));
      if (catHit || listHit) hits.push({ listId: l.id, listLabel: l.label, categoryLabel: cat.label });
    }
  }
  for (const l of locals) {
    const catHit = (l.categoryLabel || "").toLowerCase().includes(q) || (l.categoryId || "").toLowerCase().includes(q);
    const listHit =
      l.label.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q) ||
      (l.filterTags || []).some((t) => t.toLowerCase().includes(q));
    if (catHit || listHit) {
      hits.push({ listId: l.id, listLabel: l.label, categoryLabel: l.categoryLabel || "本地" });
    }
  }
  if (!hits.length) return null;
  const pool = hits.filter((h) => enabled.has(h.listId));
  const pick = (pool.length ? pool : hits)[Math.floor(Math.random() * (pool.length ? pool.length : hits.length))]!;
  const content = await fetchLexiconList(pick.listId);
  if (!content?.items?.length) return null;
  const item = content.items[Math.floor(Math.random() * content.items.length)]!;
  return {
    tags: String(item.tags || "").trim(),
    name: item.name || "",
    listLabel: content.label || pick.listLabel,
    categoryLabel: pick.categoryLabel,
  };
}
