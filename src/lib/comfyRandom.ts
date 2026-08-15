/** Random character prompt helpers for 抽卡姬 — respects generator section toggles */
import type { BuilderData } from "@/lib/promptBuilder";
import {
  composePrompt,
  filterEnabledSections,
  pickRandomSelected,
} from "@/lib/promptBuilder";

export function rollRandomCharacter(data: BuilderData | null): string | null {
  if (!data || !data.sections.length) return null;
  const filtered = filterEnabledSections(data);
  if (!filtered.sections.length) return null;
  const selected = pickRandomSelected(filtered);
  return composePrompt(filtered, selected).trim() || null;
}

export function enabledSectionCount(data: BuilderData | null): number {
  if (!data) return 0;
  return filterEnabledSections(data).sections.length;
}
