import { getDefaultEnabledIds, getLexiconIndex } from "@/lib/lexiconServer";

const LABEL = 18;
const STRING_SELECT = 3;
const MAX_SELECTS = 5;
const MAX_OPTS = 25;

export function collectModalSelectValues(data: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.values)) {
      for (const v of rec.values) out.push(String(v));
    }
    if (rec.component) walk(rec.component);
    if (rec.components) walk(rec.components);
  };
  walk(data);
  return [...new Set(out.filter(Boolean))];
}

export async function buildInspireModal(): Promise<{
  custom_id: string;
  title: string;
  components: Record<string, unknown>[];
} | null> {
  const [index, enabled] = await Promise.all([
    getLexiconIndex(),
    getDefaultEnabledIds(),
  ]);
  const enabledSet = new Set(enabled);
  const all = index.categories.flatMap((c) =>
    c.lists.map((l) => ({
      id: l.id,
      label: l.label || l.id,
      cat: c.label || c.id,
      on: enabledSet.has(l.id),
    }))
  );
  if (!all.length) return null;
  const ordered = [
    ...all.filter((x) => x.on),
    ...all.filter((x) => !x.on),
  ].slice(0, MAX_SELECTS * MAX_OPTS);
  if (!ordered.length) return null;

  const groups: { title: string; opts: typeof ordered }[] = [];
  for (const cat of index.categories) {
    const opts = ordered.filter((x) => x.cat === (cat.label || cat.id));
    if (!opts.length) continue;
    for (let i = 0; i < opts.length; i += MAX_OPTS) {
      const chunk = opts.slice(i, i + MAX_OPTS);
      groups.push({
        title: opts.length > MAX_OPTS ? `${cat.label} ${Math.floor(i / MAX_OPTS) + 1}` : cat.label,
        opts: chunk,
      });
    }
  }
  const packed =
    groups.length > 0 && groups.length <= MAX_SELECTS
      ? groups
      : Array.from({ length: Math.ceil(ordered.length / MAX_OPTS) }, (_, i) => {
          const chunk = ordered.slice(i * MAX_OPTS, (i + 1) * MAX_OPTS);
          return {
            title: `词库 ${i * MAX_OPTS + 1}–${i * MAX_OPTS + chunk.length}`,
            opts: chunk,
          };
        }).slice(0, MAX_SELECTS);

  return {
    custom_id: "inspire:modal",
    title: "灵感 · 选择词库",
    components: packed.map((g, i) => ({
      type: LABEL,
      label: String(g.title || "词库").slice(0, 45),
      description: "可多选；不改则抽站点默认已启动的",
      component: {
        type: STRING_SELECT,
        custom_id: `inspire_l${i}`,
        min_values: 0,
        max_values: g.opts.length,
        required: false,
        placeholder: "选择这一组要抽的词库",
        options: g.opts.map((o) => ({
          label: o.label.slice(0, 100),
          value: o.id.slice(0, 100),
          description: o.cat.slice(0, 100),
          default: o.on,
        })),
      },
    })),
  };
}
