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
  timeline: TimelineEvent[];
  relationships: Relationship[];
  gallery: GalleryImage[];
  prompts: StoredPrompt[];
  createdAt: string;
  updatedAt: string;
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
  emotions: defaultEmotions(),
  combat: {
    experience: 50,
    collaboration: 50,
    conflict: 50,
    intelligence: 50,
    adaptability: 50,
  },
  happiness: defaultHappiness(),
  preferences: [],
  outward: defaultOutward(),
  story: "",
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
  const defaults = defaultEmotions();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return defaults;
}

export function migrateHappiness(raw: unknown): DotItem[] {
  if (Array.isArray(raw)) return raw as DotItem[];
  const defaults = defaultHappiness();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return defaults;
}

export function migrateOutward(raw: unknown): DotItem[] {
  if (Array.isArray(raw)) return raw as DotItem[];
  const defaults = defaultOutward();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, number>;
    return defaults.map((d) => ({
      ...d,
      value: typeof o[d.id] === "number" ? o[d.id] : d.value,
    }));
  }
  return defaults;
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
