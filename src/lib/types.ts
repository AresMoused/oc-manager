export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  importance?: "normal" | "major" | "critical";
}

export interface Relationship {
  id: string;
  targetId: string;
  type: "friend" | "family" | "ally" | "enemy" | "rival" | "lover" | "mentor" | "other";
  strength: number;
  note: string;
}

export interface PreferenceItem {
  id: string;
  title: string;
  content: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface StoredPrompt {
  id: string;
  text: string;
  label?: string;
  createdAt: string;
}

export interface BipolarSliderItem {
  id: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
}

export interface BipolarDotItem {
  id: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
}

export interface DotItem {
  id: string;
  label: string;
  value: number;
}

export type ModuleWidth = "half" | "full";

export interface RadarAxis {
  id: string;
  label: string;
  value: number;
}

export interface SliderModule {
  id: string;
  type: "sliders";
  title: string;
  width: ModuleWidth;
  items: BipolarSliderItem[];
}

export interface RadarModule {
  id: string;
  type: "radar";
  title: string;
  width: ModuleWidth;
  axes: RadarAxis[];
}

export interface TextListModule {
  id: string;
  type: "text-list";
  title: string;
  width: ModuleWidth;
  items: PreferenceItem[];
}

export interface TextLongModule {
  id: string;
  type: "text-long";
  title: string;
  width: ModuleWidth;
  body: string;
}

export type SheetModule =
  | SliderModule
  | RadarModule
  | TextListModule
  | TextLongModule;

export type SheetModuleType = SheetModule["type"];

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: number | string;
  race: string;
  height: string;
  weight: string;
  affiliation: string;
  identity: string;
  /** 现住地 */
  residence: string;
  /** 派系 */
  faction: string;
  birthplace: string;
  avatar: string;
  world: string;
  traits: BipolarSliderItem[];
  emotions: BipolarDotItem[];
  combat: {
    experience: number;
    collaboration: number;
    conflict: number;
    intelligence: number;
    adaptability: number;
  };
  happiness: DotItem[];
  preferences: PreferenceItem[];
  outward: DotItem[];
  story: string;
  /** Customizable sheet modules. Absent on legacy cards until normalize. */
  modules: SheetModule[];
  timeline: TimelineEvent[];
  relationships: Relationship[];
  gallery: GalleryImage[];
  prompts: StoredPrompt[];
  createdAt: string;
  updatedAt: string;
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultTraits(): BipolarSliderItem[] {
  return [
    { id: "optimistic", leftLabel: "乐观", rightLabel: "悲观", value: 50 },
    { id: "open", leftLabel: "开放", rightLabel: "保守", value: 50 },
    { id: "emotional", leftLabel: "感性", rightLabel: "理性", value: 50 },
    { id: "decisive", leftLabel: "果断", rightLabel: "犹豫", value: 50 },
    { id: "talkative", leftLabel: "健谈", rightLabel: "寡言", value: 50 },
    { id: "adventurous", leftLabel: "冒险", rightLabel: "谨慎", value: 50 },
    { id: "gentle", leftLabel: "随和", rightLabel: "挑剔", value: 50 },
  ];
}

export function defaultEmotions(): BipolarDotItem[] {
  return [
    { id: "extrovert", leftLabel: "外向", rightLabel: "内向", value: 3 },
    { id: "positive", leftLabel: "积极", rightLabel: "消极", value: 3 },
    { id: "brave", leftLabel: "勇敢", rightLabel: "胆小", value: 3 },
    { id: "passionate", leftLabel: "热情", rightLabel: "冷漠", value: 3 },
    { id: "diligent", leftLabel: "勤奋", rightLabel: "懒惰", value: 3 },
    { id: "generous", leftLabel: "慷慨", rightLabel: "吝啬", value: 3 },
    { id: "honest", leftLabel: "诚实", rightLabel: "虚伪", value: 3 },
    { id: "tolerant", leftLabel: "宽容", rightLabel: "苛刻", value: 3 },
    { id: "strong", leftLabel: "坚强", rightLabel: "脆弱", value: 3 },
    { id: "cheerful", leftLabel: "开朗", rightLabel: "忧郁", value: 3 },
  ];
}

export function defaultHappiness(): DotItem[] {
  return [
    { id: "family", label: "家庭", value: 3 },
    { id: "emotion", label: "情感", value: 3 },
    { id: "health", label: "健康", value: 3 },
    { id: "economy", label: "经济", value: 3 },
    { id: "interpersonal", label: "人际", value: 3 },
    { id: "status", label: "地位", value: 3 },
    { id: "growth", label: "成长", value: 3 },
    { id: "psychology", label: "心理", value: 3 },
    { id: "autonomy", label: "自主", value: 3 },
  ];
}

export function defaultOutward(): DotItem[] {
  return [
    { id: "ordinary", label: "平凡", value: 3 },
    { id: "optimistic", label: "乐天", value: 3 },
    { id: "calm", label: "平静", value: 3 },
    { id: "efficient", label: "高效", value: 3 },
    { id: "friendly", label: "友善", value: 3 },
    { id: "steady", label: "稳重", value: 3 },
  ];
}

export function defaultCombat(): Character["combat"] {
  return {
    experience: 50,
    collaboration: 50,
    conflict: 50,
    intelligence: 50,
    adaptability: 50,
  };
}

export function defaultCombatAxes(combat?: Character["combat"]): RadarAxis[] {
  const c = combat || defaultCombat();
  return [
    { id: "experience", label: "经验", value: clamp100(c.experience) },
    { id: "collaboration", label: "协作", value: clamp100(c.collaboration) },
    { id: "conflict", label: "冲突", value: clamp100(c.conflict) },
    { id: "intelligence", label: "智取", value: clamp100(c.intelligence) },
    { id: "adaptability", label: "应变", value: clamp100(c.adaptability) },
  ];
}

function clamp100(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function axesToCombat(axes: RadarAxis[]): Character["combat"] {
  const map: Record<string, number> = {};
  for (const a of axes) map[a.id] = clamp100(a.value);
  const d = defaultCombat();
  return {
    experience: map.experience ?? d.experience,
    collaboration: map.collaboration ?? d.collaboration,
    conflict: map.conflict ?? d.conflict,
    intelligence: map.intelligence ?? d.intelligence,
    adaptability: map.adaptability ?? d.adaptability,
  };
}

export function defaultModules(): SheetModule[] {
  return [
    {
      id: "mod-traits",
      type: "sliders",
      title: "特质分析",
      width: "half",
      items: defaultTraits(),
    },
    {
      id: "mod-combat",
      type: "radar",
      title: "战斗风格",
      width: "half",
      axes: defaultCombatAxes(),
    },
    {
      id: "mod-prefs",
      type: "text-list",
      title: "个人喜好",
      width: "half",
      items: [],
    },
  ];
}

export function createSheetModule(type: SheetModuleType): SheetModule {
  switch (type) {
    case "sliders":
      return {
        id: uid(),
        type: "sliders",
        title: "特质分析",
        width: "half",
        items: [
          {
            id: uid(),
            leftLabel: "左侧",
            rightLabel: "右侧",
            value: 50,
          },
        ],
      };
    case "radar":
      return {
        id: uid(),
        type: "radar",
        title: "战斗风格",
        width: "half",
        axes: defaultCombatAxes(),
      };
    case "text-list":
      return {
        id: uid(),
        type: "text-list",
        title: "个人喜好",
        width: "half",
        items: [],
      };
    case "text-long":
      return {
        id: uid(),
        type: "text-long",
        title: "长文本",
        width: "full",
        body: "",
      };
  }
}

function asWidth(v: unknown): ModuleWidth {
  return v === "full" ? "full" : "half";
}

export function sanitizeModule(raw: unknown): SheetModule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : uid();
  const title = typeof o.title === "string" && o.title.trim() ? o.title : "模块";
  const width = asWidth(o.width);
  if (o.type === "sliders") {
    const items = Array.isArray(o.items)
      ? (o.items as BipolarSliderItem[]).map((it) => ({
          id: it.id || uid(),
          leftLabel: String(it.leftLabel ?? ""),
          rightLabel: String(it.rightLabel ?? ""),
          value: clamp100(it.value),
        }))
      : [];
    return { id, type: "sliders", title, width, items };
  }
  if (o.type === "radar") {
    let axes: RadarAxis[] = Array.isArray(o.axes)
      ? (o.axes as RadarAxis[]).map((it) => ({
          id: it.id || uid(),
          label: String(it.label ?? "轴"),
          value: clamp100(it.value),
        }))
      : defaultCombatAxes();
    if (axes.length < 3) axes = defaultCombatAxes();
    if (axes.length > 8) axes = axes.slice(0, 8);
    return { id, type: "radar", title, width, axes };
  }
  if (o.type === "text-list") {
    const items = Array.isArray(o.items)
      ? (o.items as PreferenceItem[]).map((it) => ({
          id: it.id || uid(),
          title: String(it.title ?? ""),
          content: String(it.content ?? ""),
        }))
      : [];
    return { id, type: "text-list", title, width, items };
  }
  if (o.type === "text-long") {
    return {
      id,
      type: "text-long",
      title,
      width,
      body: typeof o.body === "string" ? o.body : "",
    };
  }
  return null;
}

export function modulesFromLegacy(c: {
  traits?: unknown;
  combat?: Character["combat"];
  preferences?: unknown;
}): SheetModule[] {
  return [
    {
      id: "mod-traits",
      type: "sliders",
      title: "特质分析",
      width: "half",
      items: migrateTraits(c.traits),
    },
    {
      id: "mod-combat",
      type: "radar",
      title: "战斗风格",
      width: "half",
      axes: defaultCombatAxes(c.combat),
    },
    {
      id: "mod-prefs",
      type: "text-list",
      title: "个人喜好",
      width: "half",
      items: migratePreferences(c.preferences),
    },
  ];
}

/** Missing modules → migrate from legacy fields. Empty array is kept (user deleted all). */
export function normalizeModules(
  raw: unknown,
  legacy: {
    traits?: unknown;
    combat?: Character["combat"];
    preferences?: unknown;
  }
): SheetModule[] {
  if (!Array.isArray(raw)) return modulesFromLegacy(legacy);
  return raw.map(sanitizeModule).filter((m): m is SheetModule => m !== null);
}

export function legacyFieldsFromModules(
  modules: SheetModule[],
  fallback?: {
    traits?: BipolarSliderItem[];
    combat?: Character["combat"];
    preferences?: PreferenceItem[];
  }
): Pick<Character, "traits" | "combat" | "preferences"> {
  const sliders = modules.find((m): m is SliderModule => m.type === "sliders");
  const radar = modules.find((m): m is RadarModule => m.type === "radar");
  const list = modules.find((m): m is TextListModule => m.type === "text-list");
  return {
    traits: sliders ? sliders.items : fallback?.traits ?? defaultTraits(),
    combat: radar ? axesToCombat(radar.axes) : fallback?.combat ?? defaultCombat(),
    preferences: list ? list.items : fallback?.preferences ?? [],
  };
}

export const defaultCharacter = (): Omit<
  Character,
  "id" | "createdAt" | "updatedAt"
> => ({
  name: "New Character",
  gender: "Unknown",
  age: 18,
  race: "Human",
  height: "170 cm",
  weight: "60 kg",
  affiliation: "None",
  identity: "Adventurer",
  residence: "",
  faction: "",
  birthplace: "",
  avatar: "",
  world: "",
  traits: defaultTraits(),
  emotions: [],
  combat: defaultCombat(),
  happiness: [],
  preferences: [],
  outward: [],
  story: "",
  modules: defaultModules(),
  timeline: [],
  relationships: [],
  gallery: [],
  prompts: [],
});

export function migrateTraits(raw: unknown): BipolarSliderItem[] {
  if (Array.isArray(raw)) return raw as BipolarSliderItem[];
  const defaults = defaultTraits();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return defaults;
}

export function migrateEmotions(raw: unknown): BipolarDotItem[] {
  if (Array.isArray(raw)) return raw as BipolarDotItem[];
  if (!raw) return [];
  const defaults = defaultEmotions();
  if (typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return [];
}

export function migrateHappiness(raw: unknown): DotItem[] {
  if (Array.isArray(raw)) return raw as DotItem[];
  if (!raw) return [];
  const defaults = defaultHappiness();
  if (typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return [];
}

export function migrateOutward(raw: unknown): DotItem[] {
  if (Array.isArray(raw)) return raw as DotItem[];
  if (!raw) return [];
  const defaults = defaultOutward();
  if (typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return [];
}

export function migratePreferences(raw: unknown): PreferenceItem[] {
  if (Array.isArray(raw)) return raw as PreferenceItem[];
  if (raw && typeof raw === "object") {
    const old = raw as Record<string, string>;
    const items: PreferenceItem[] = [];
    const map: [string, string][] = [
      ["listeningWind", "聆听风语 · Listening to the Wind"],
      ["gazingStars", "仰望星空 · Gazing at the Stars"],
      ["recordingSights", "记录见闻 · Recording Sights"],
    ];
    for (const [key, title] of map) {
      if (old[key]) {
        items.push({ id: key, title, content: old[key] });
      }
    }
    return items;
  }
  return [];
}
