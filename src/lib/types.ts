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

/** Custom preference block (user-defined title + content) */
export interface PreferenceItem {
  id: string;
  title: string;
  content: string;
}

/** Gallery image (prefer Discord CDN / any URL) */
export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface Character {
  id: string;
  // Basic
  name: string;
  gender: string;
  age: number | string;
  race: string;
  height: string;
  weight: string;
  affiliation: string;
  identity: string;
  talent: string;
  personality: string;
  birthplace: string;
  avatar: string;
  /** World / Setting / Universe this character belongs to */
  world: string;

  traits: {
    optimistic: number;
    open: number;
    emotional: number;
    decisive: number;
    talkative: number;
    adventurous: number;
    gentle: number;
  };

  emotions: {
    extrovert: number;
    positive: number;
    brave: number;
    passionate: number;
    diligent: number;
    generous: number;
    honest: number;
    tolerant: number;
    strong: number;
    cheerful: number;
  };

  combat: {
    experience: number;
    collaboration: number;
    conflict: number;
    intelligence: number;
    adaptability: number;
  };

  happiness: {
    family: number;
    emotion: number;
    health: number;
    economy: number;
    interpersonal: number;
    status: number;
    growth: number;
    psychology: number;
    autonomy: number;
  };

  /** Dynamic preference list (user can add/remove) */
  preferences: PreferenceItem[];

  outward: {
    ordinary: number;
    optimistic: number;
    calm: number;
    efficient: number;
    friendly: number;
    steady: number;
  };

  story: string;
  timeline: TimelineEvent[];
  relationships: Relationship[];
  /** Image gallery (URLs, e.g. Discord CDN) */
  gallery: GalleryImage[];

  createdAt: string;
  updatedAt: string;
}

export const defaultCharacter = (): Omit<Character, "id" | "createdAt" | "updatedAt"> => ({
  name: "New Character",
  gender: "Unknown",
  age: 18,
  race: "Human",
  height: "170 cm",
  weight: "60 kg",
  affiliation: "None",
  identity: "Adventurer",
  talent: "",
  personality: "",
  birthplace: "",
  avatar: "",
  world: "",
  traits: {
    optimistic: 50,
    open: 50,
    emotional: 50,
    decisive: 50,
    talkative: 50,
    adventurous: 50,
    gentle: 50,
  },
  emotions: {
    extrovert: 3,
    positive: 3,
    brave: 3,
    passionate: 3,
    diligent: 3,
    generous: 3,
    honest: 3,
    tolerant: 3,
    strong: 3,
    cheerful: 3,
  },
  combat: {
    experience: 50,
    collaboration: 50,
    conflict: 50,
    intelligence: 50,
    adaptability: 50,
  },
  happiness: {
    family: 3,
    emotion: 3,
    health: 3,
    economy: 3,
    interpersonal: 3,
    status: 3,
    growth: 3,
    psychology: 3,
    autonomy: 3,
  },
  preferences: [],
  outward: {
    ordinary: 3,
    optimistic: 3,
    calm: 3,
    efficient: 3,
    friendly: 3,
    steady: 3,
  },
  story: "",
  timeline: [],
  relationships: [],
  gallery: [],
});

/** Migrate old hardcoded preferences object → new array format */
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
        items.push({
          id: key,
          title,
          content: old[key],
        });
      }
    }
    return items;
  }
  return [];
}
