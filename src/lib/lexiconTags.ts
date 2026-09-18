export const PERSON_TAG = "人物";
export const SCENE_TAG = "场景";
export const ROLE_TAGS = [PERSON_TAG, SCENE_TAG] as const;
export type LexiconRoleTag = (typeof ROLE_TAGS)[number];

const SCENE_HINT =
  /场景|背景|地点|环境|风景|室内|室外|setting|scene|background|location|place|backdrop/;

export function parseTagList(raw: string | string[] | undefined | null): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || "").split(/[,，;；|]/);
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

export function pickRoleTag(tags?: string[] | null): LexiconRoleTag | null {
  const list = tags || [];
  if (list.includes(PERSON_TAG)) return PERSON_TAG;
  if (list.includes(SCENE_TAG)) return SCENE_TAG;
  return null;
}

export function hasRoleTag(tags?: string[] | null): boolean {
  return pickRoleTag(tags) != null;
}

export function inferRoleTag(text: string): LexiconRoleTag {
  return SCENE_HINT.test(String(text || "").toLowerCase()) ? SCENE_TAG : PERSON_TAG;
}

export function withRoleTag(
  tags: string[] | undefined,
  role: LexiconRoleTag
): string[] {
  const rest = (tags || []).filter((t) => t !== PERSON_TAG && t !== SCENE_TAG);
  return [role, ...rest];
}

export function ensureListRoleTag(
  list: { id: string; label: string; filterTags?: string[] },
  category?: { id: string; label: string }
): boolean {
  if (hasRoleTag(list.filterTags)) return false;
  const blob = [category?.id, category?.label, list.id, list.label, ...(list.filterTags || [])]
    .filter(Boolean)
    .join(" ");
  list.filterTags = withRoleTag(list.filterTags, inferRoleTag(blob));
  return true;
}
