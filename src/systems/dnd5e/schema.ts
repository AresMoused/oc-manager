export const ABILITIES = [
  { id: "str", label: "力量" },
  { id: "dex", label: "敏捷" },
  { id: "con", label: "体质" },
  { id: "int", label: "智力" },
  { id: "wis", label: "感知" },
  { id: "cha", label: "魅力" },
] as const;

export type AbilityId = (typeof ABILITIES)[number]["id"];

export const SKILLS: {
  id: string;
  label: string;
  ability: AbilityId;
}[] = [
  { id: "athletics", label: "运动", ability: "str" },
  { id: "acrobatics", label: "特技", ability: "dex" },
  { id: "sleight", label: "巧手", ability: "dex" },
  { id: "stealth", label: "隐匿", ability: "dex" },
  { id: "arcana", label: "奥秘", ability: "int" },
  { id: "history", label: "历史", ability: "int" },
  { id: "investigation", label: "调查", ability: "int" },
  { id: "nature", label: "自然", ability: "int" },
  { id: "religion", label: "宗教", ability: "int" },
  { id: "animal", label: "驯养动物", ability: "wis" },
  { id: "insight", label: "洞悉", ability: "wis" },
  { id: "medicine", label: "医药", ability: "wis" },
  { id: "perception", label: "察觉", ability: "wis" },
  { id: "survival", label: "生存", ability: "wis" },
  { id: "deception", label: "欺瞒", ability: "cha" },
  { id: "intimidation", label: "威吓", ability: "cha" },
  { id: "performance", label: "表演", ability: "cha" },
  { id: "persuasion", label: "说服", ability: "cha" },
];

export type AdvPreset = "none" | "adv" | "dis";

export interface DndSkillState {
  proficient: boolean;
  expertise: boolean;
  misc: number;
  adv: AdvPreset;
}

export interface DndWeapon {
  id: string;
  name: string;
  ability: AbilityId;
  proficient: boolean;
  finesse: boolean;
  ranged: boolean;
  magic: number;
  dmgCount: number;
  dmgFaces: number;
  dmgBonus: number;
  dmgType: string;
  range: string;
  notes: string;
}

export interface DndItem {
  id: string;
  name: string;
  qty: number;
  weight: number;
  equipped: boolean;
  notes: string;
}

export interface DndSpell {
  id: string;
  name: string;
  level: number;
  prepared: boolean;
  notes: string;
}

export interface DndClassRow {
  name: string;
  level: number;
}

export interface DndPlayData {
  abilities: Record<AbilityId, number>;
  saveProf: Record<AbilityId, boolean>;
  skills: Record<string, DndSkillState>;
  classes: DndClassRow[];
  xp: number;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  speedWalk: number;
  speedSwim: number;
  speedFly: number;
  speedClimb: number;
  armorName: string;
  armorBase: number;
  armorDexMax: number | null;
  shield: number;
  otherAc: number;
  inspiration: number;
  hitDice: string;
  deathSuccess: boolean[];
  deathFail: boolean[];
  gp: number;
  sp: number;
  cp: number;
  encumbranceVariant: boolean;
  weapons: DndWeapon[];
  items: DndItem[];
  spellcastingOn: boolean;
  spellAbility: AbilityId;
  spellAbility2: AbilityId | "";
  spellSlots: number[];
  spells: DndSpell[];
  features: { id: string; name: string; uses: string; body: string }[];
  languages: string;
  proficiencies: string;
}

function uid() {
  return crypto.randomUUID();
}

export function abilityMod(score: number): number {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  const lv = Math.max(1, Math.min(20, Number(level) || 1));
  return 2 + Math.floor((lv - 1) / 4);
}

export function totalLevel(data: DndPlayData): number {
  const n = data.classes.reduce((s, c) => s + (Number(c.level) || 0), 0);
  return Math.max(1, n);
}

export function signed(n: number): string {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : String(v);
}

export function skillBonus(data: DndPlayData, skillId: string): number {
  const def = SKILLS.find((s) => s.id === skillId);
  if (!def) return 0;
  const st = data.skills[skillId];
  const pb = proficiencyBonus(totalLevel(data));
  let n = abilityMod(data.abilities[def.ability]);
  if (st?.proficient) n += pb;
  if (st?.expertise) n += pb;
  n += Number(st?.misc) || 0;
  return n;
}

export function saveBonus(data: DndPlayData, abi: AbilityId): number {
  const pb = proficiencyBonus(totalLevel(data));
  return abilityMod(data.abilities[abi]) + (data.saveProf[abi] ? pb : 0);
}

export function weaponAttackBonus(data: DndPlayData, w: DndWeapon): number {
  const pb = proficiencyBonus(totalLevel(data));
  let abi: AbilityId = w.ability;
  if (w.finesse) {
    abi = abilityMod(data.abilities.dex) >= abilityMod(data.abilities.str) ? "dex" : "str";
  } else if (w.ranged) {
    abi = "dex";
  }
  return (
    abilityMod(data.abilities[abi]) +
    (w.proficient ? pb : 0) +
    (Number(w.magic) || 0)
  );
}

export function weaponDamageBonus(data: DndPlayData, w: DndWeapon): number {
  let abi: AbilityId = w.ability;
  if (w.finesse) {
    abi = abilityMod(data.abilities.dex) >= abilityMod(data.abilities.str) ? "dex" : "str";
  } else if (w.ranged) {
    abi = "dex";
  }
  return abilityMod(data.abilities[abi]) + (Number(w.magic) || 0) + (Number(w.dmgBonus) || 0);
}

export function armorClass(data: DndPlayData): number {
  const dex = abilityMod(data.abilities.dex);
  const cap = data.armorDexMax;
  const dexPart = cap === null ? dex : Math.min(dex, cap);
  const base = Number(data.armorBase) || 10;
  return base + dexPart + (Number(data.shield) || 0) + (Number(data.otherAc) || 0);
}

export function carryingCap(data: DndPlayData): number {
  return (Number(data.abilities.str) || 10) * 15;
}

export function currentWeight(data: DndPlayData): number {
  return data.items.reduce(
    (s, it) => s + (Number(it.weight) || 0) * (Number(it.qty) || 1),
    0
  );
}

export function spellSaveDc(data: DndPlayData, abi: AbilityId): number {
  return 8 + proficiencyBonus(totalLevel(data)) + abilityMod(data.abilities[abi]);
}

export function spellAttack(data: DndPlayData, abi: AbilityId): number {
  return proficiencyBonus(totalLevel(data)) + abilityMod(data.abilities[abi]);
}

export function passiveSkill(data: DndPlayData, skillId: string): number {
  return 10 + skillBonus(data, skillId);
}

function emptySkills(): Record<string, DndSkillState> {
  const o: Record<string, DndSkillState> = {};
  for (const s of SKILLS) {
    o[s.id] = { proficient: false, expertise: false, misc: 0, adv: "none" };
  }
  return o;
}

export function defaultDndPlay(): DndPlayData {
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  return {
    abilities,
    saveProf: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: emptySkills(),
    classes: [{ name: "", level: 1 }],
    xp: 0,
    hpCurrent: 8,
    hpMax: 8,
    hpTemp: 0,
    speedWalk: 30,
    speedSwim: 0,
    speedFly: 0,
    speedClimb: 0,
    armorName: "无甲",
    armorBase: 10,
    armorDexMax: null,
    shield: 0,
    otherAc: 0,
    inspiration: 0,
    hitDice: "1d8",
    deathSuccess: [false, false, false],
    deathFail: [false, false, false],
    gp: 0,
    sp: 0,
    cp: 0,
    encumbranceVariant: false,
    weapons: [
      {
        id: uid(),
        name: "匕首",
        ability: "dex",
        proficient: true,
        finesse: true,
        ranged: false,
        magic: 0,
        dmgCount: 1,
        dmgFaces: 4,
        dmgBonus: 0,
        dmgType: "穿刺",
        range: "5（20/60）",
        notes: "轻型 灵巧",
      },
    ],
    items: [],
    spellcastingOn: false,
    spellAbility: "cha",
    spellAbility2: "",
    spellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    spells: [],
    features: [],
    languages: "",
    proficiencies: "",
  };
}

export function parseDndPlay(raw: unknown): DndPlayData {
  const d = defaultDndPlay();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Partial<DndPlayData>;
  return {
    ...d,
    ...o,
    abilities: { ...d.abilities, ...(o.abilities || {}) },
    saveProf: { ...d.saveProf, ...(o.saveProf || {}) },
    skills: { ...d.skills, ...(o.skills || {}) },
    classes: Array.isArray(o.classes) && o.classes.length ? o.classes : d.classes,
    weapons: Array.isArray(o.weapons) ? o.weapons : d.weapons,
    items: Array.isArray(o.items) ? o.items : d.items,
    spells: Array.isArray(o.spells) ? o.spells : d.spells,
    features: Array.isArray(o.features) ? o.features : d.features,
    spellSlots: Array.isArray(o.spellSlots) ? o.spellSlots : d.spellSlots,
    deathSuccess: Array.isArray(o.deathSuccess) ? o.deathSuccess : d.deathSuccess,
    deathFail: Array.isArray(o.deathFail) ? o.deathFail : d.deathFail,
  };
}

export function wrapPlay(data: DndPlayData) {
  return { system: "dnd5e", version: 1, data };
}
