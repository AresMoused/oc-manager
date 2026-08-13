export interface TimelineEvent {
  id: string;
  date: string; // YYYY-MM-DD or free text
  title: string;
  description: string;
  importance?: "normal" | "major" | "critical";
}

export interface Relationship {
  id: string;
  targetId: string;
  type: "friend" | "family" | "ally" | "enemy" | "rival" | "lover" | "mentor" | "other";
  strength: number; // 1-5
  note: string;
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
  avatar: string; // base64 or url

  // Trait analysis (0-100, higher = left side of bipolar)
  traits: {
    optimistic: number; // vs pessimistic
    open: number; // vs conservative
    emotional: number; // vs rational
    decisive: number; // vs hesitant
    talkative: number; // vs taciturn
    adventurous: number; // vs cautious
    gentle: number; // vs critical
  };

  // Emotional assessment 0-5 (higher = left label)
  emotions: {
    extrovert: number; // vs introvert
    positive: number; // vs negative
    brave: number; // vs timid
    passionate: number; // vs indifferent
    diligent: number; // vs lazy
    generous: number; // vs stingy
    honest: number; // vs dishonest
    tolerant: number; // vs harsh
    strong: number; // vs fragile
    cheerful: number; // vs melancholy
  };

  // Combat style radar 0-100
  combat: {
    experience: number;
    collaboration: number;
    conflict: number;
    intelligence: number;
    adaptability: number;
  };

  // Happiness index 0-5
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

  // Personal preferences (text blocks)
  preferences: {
    listeningWind: string;
    gazingStars: string;
    recordingSights: string;
  };

  // Outward performance 0-5
  outward: {
    ordinary: number;
    optimistic: number;
    calm: number;
    efficient: number;
    friendly: number;
    steady: number;
  };

  // Story experience
  story: string;

  // Timeline
  timeline: TimelineEvent[];

  // Relationships
  relationships: Relationship[];

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
  preferences: {
    listeningWind: "",
    gazingStars: "",
    recordingSights: "",
  },
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
});
