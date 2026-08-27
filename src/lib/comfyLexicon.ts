"use client";

import type { BuilderData } from "@/lib/promptBuilder";
import { normalizeBuilderData, saveCachedBuilder } from "@/lib/promptBuilder";
import {
  buildEnabledBuilderData,
  composeFromSections,
  fetchLexiconCatalog,
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
