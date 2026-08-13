import { Character, defaultCharacter } from "./types";

const STORAGE_KEY = "oc-manager-characters-v1";

export function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSampleCharacters();
    return JSON.parse(raw) as Character[];
  } catch {
    return getSampleCharacters();
  }
}

export function saveCharacters(chars: Character[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  } catch (err) {
    // QuotaExceededError – try stripping large base64 avatars and retry once
    console.warn("localStorage quota exceeded, attempting cleanup…", err);
    const cleaned = chars.map((c) => {
      if (c.avatar && c.avatar.startsWith("data:") && c.avatar.length > 80_000) {
        return { ...c, avatar: "" }; // drop oversized base64
      }
      return c;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      alert(
        "Storage almost full. Some large local avatars were cleared.\n" +
          "Tip: use image URLs (Discord / Imgur) instead of uploading files."
      );
    } catch {
      alert(
        "Browser storage is full. Please export your data, clear some avatars, or use image URLs."
      );
    }
  }
}

export function createId(): string {
  return crypto.randomUUID();
}

export function getSampleCharacters(): Character[] {
  const now = new Date().toISOString();
  return [
    {
      id: "sample-fiona",
      name: "菲欧娜 (Fiona)",
      gender: "女",
      age: 16,
      race: "精灵",
      height: "168 cm",
      weight: "45 kg",
      affiliation: "中立善良",
      identity: "巡游斥候 / 自由的冒险者",
      talent: "风之加护",
      personality: "外冷内热，责任心强",
      birthplace: "绿叶边境·溪木镇",
      avatar: "",
      traits: {
        optimistic: 50,
        open: 73,
        emotional: 50,
        decisive: 32,
        talkative: 80,
        adventurous: 21,
        gentle: 38,
      },
      emotions: {
        extrovert: 4,
        positive: 2,
        brave: 3,
        passionate: 3,
        diligent: 3,
        generous: 3,
        honest: 2,
        tolerant: 3,
        strong: 2,
        cheerful: 4,
      },
      combat: {
        experience: 64,
        collaboration: 54,
        conflict: 48,
        intelligence: 49,
        adaptability: 67,
      },
      happiness: {
        family: 3,
        emotion: 4,
        health: 2,
        economy: 2,
        interpersonal: 5,
        status: 2,
        growth: 2,
        psychology: 3,
        autonomy: 4,
      },
      preferences: {
        listeningWind:
          "她最爱在高处闭着眼，感受风穿过发梢与耳畔。",
        gazingStars:
          "清澈的异界夜空下，她能一动不动地躺上整夜，星辰是她孤独旅途中永恒且沉默的同伴。",
        recordingSights:
          "用炭笔素描陌生的植物、奇特的生物，这是她与世界的对话方式。",
      },
      outward: {
        ordinary: 3,
        optimistic: 4,
        calm: 2,
        efficient: 3,
        friendly: 5,
        steady: 2,
      },
      story: `菲欧娜曾是绿叶边境溪木镇的半精灵少女，直到“黑铁之乱”的烈焰吞噬了她的家园。她亲眼目睹精灵母亲与人类父亲为保护她而倒在血泊中，手中只余母亲那枚银质树叶别针。葬礼后的黎明，她站在仍冒着青烟的废墟上，将别针紧紧扣在肩头。风中不再有精灵的歌谣与人类的炊烟，只有哭泣。她终于明白，任何种族的法律与神明都无法真正守护弱小。\n\n那一天，她拾起父亲遗留的长弓，转身走入苍茫林海。从此，世上少了一个天真的少女，多了一位独行的“翠风箭矢”。她的弓矢不再为任何王国而战，只遵从风中传来的、那些微弱的求救声。`,
      timeline: [
        {
          id: "e1",
          date: "Year 0",
          title: "Black Iron Chaos",
          description:
            "Home destroyed. Parents sacrificed themselves. Fiona becomes a lone scout.",
          importance: "critical",
        },
        {
          id: "e2",
          date: "Year 1",
          title: "First Arrow of Mercy",
          description:
            "Saved a human child from goblins. Realized the wind still carries hope.",
          importance: "major",
        },
      ],
      relationships: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function exportCharacters(chars: Character[]): string {
  return JSON.stringify(chars, null, 2);
}

export function importCharacters(json: string): Character[] {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Invalid format");
  return data as Character[];
}
