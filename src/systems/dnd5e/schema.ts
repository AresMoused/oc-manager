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
  { id: "insight", label: "察言观色", ability: "wis" },
  { id: "medicine", label: "医药", ability: "wis" },
  { id: "perception", label: "察觉", ability: "wis" },
  { id: "survival", label: "生存", ability: "wis" },
  { id: "deception", label: "欺瞒", ability: "cha" },
  { id: "intimidation", label: "威吓", ability: "cha" },
  { id: "performance", label: "表演", ability: "cha" },
  { id: "persuasion", label: "说服", ability: "cha" },
];

export const SPELL_SCHOOLS = [
  "防护",
  "咒法",
  "预言",
  "惑控",
  "塑能",
  "幻术",
  "死灵",
  "变化",
] as const;

export const SPELL_LEVEL_LABELS = [
  "戏法",
  "一环",
  "二环",
  "三环",
  "四环",
  "五环",
  "六环",
  "七环",
  "八环",
  "九环",
] as const;

export type AdvPreset = "none" | "adv" | "dis";
export type PanelWidth = "half" | "full";
export type PanelId =
  | "level"
  | "abilities"
  | "skills"
  | "survival"
  | "conditions"
  | "attacks"
  | "gear"
  | "spells"
  | "profs"
  | "features";

export const DEFAULT_PANEL_ORDER: PanelId[] = [
  "level",
  "abilities",
  "skills",
  "survival",
  "conditions",
  "attacks",
  "gear",
  "spells",
  "profs",
  "features",
];

export const PANEL_TITLE: Record<PanelId, string> = {
  level: "等级",
  abilities: "属性 / 豁免",
  skills: "技能",
  survival: "状态",
  conditions: "特殊状态",
  attacks: "攻击",
  gear: "装备",
  spells: "法术",
  profs: "语言 / 熟练",
  features: "特征 & 能力",
};

export const DEFAULT_PANEL_WIDTH: Record<PanelId, PanelWidth> = {
  level: "full",
  abilities: "full",
  skills: "half",
  survival: "half",
  conditions: "half",
  attacks: "full",
  gear: "full",
  spells: "full",
  profs: "half",
  features: "half",
};

export const RESOURCE_PRESETS = [
  "荒野型态",
  "引导神力",
  "先攻骰",
  "激励骰",
  "偷袭骰",
  "卓越骰",
  "术法点",
  "狂暴",
  "武艺",
  "气",
] as const;

export const CONDITION_PRESETS = [
  "目盲",
  "魅惑",
  "耳聋",
  "恐慌",
  "受擒",
  "失能",
  "隐形",
  "麻痹",
  "石化",
  "中毒",
  "倒地",
  "束缚",
  "震慑",
  "昏迷",
  "力竭",
] as const;

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
  weight: number;
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
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  effect: string;
  concentration: boolean;
  ritual: boolean;
  v: boolean;
  s: boolean;
  m: boolean;
  materials: string;
}

export interface DndClassRow {
  name: string;
  level: number;
}

export interface DndFeature {
  id: string;
  name: string;
  uses: string;
  body: string;
}

export interface DndProfSource {
  languages: string;
  skills: string;
  weapons: string;
  armor: string;
  tools: string;
}

export interface DndProfs {
  race: DndProfSource;
  class: DndProfSource;
  background: DndProfSource;
}

export interface DndResource {
  id: string;
  name: string;
  value: string;
  remaining: number;
}

export interface DndCondition {
  id: string;
  name: string;
  notes: string;
}

export const EMPTY_PROF: DndProfSource = {
  languages: "",
  skills: "",
  weapons: "",
  armor: "",
  tools: "",
};

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
  pactSlotLevel: number;
  spells: DndSpell[];
  features: DndFeature[];
  featuresRace: DndFeature[];
  featuresClass: DndFeature[];
  languages: string;
  proficiencies: string;
  profs: DndProfs;
  panelWidth: Record<PanelId, PanelWidth>;
  panelOrder: PanelId[];
  resources: DndResource[];
  conditions: DndCondition[];
  spellSlotsLeft: number[];
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

export function weaponAbility(data: DndPlayData, w: DndWeapon): AbilityId {
  if (w.finesse) {
    return abilityMod(data.abilities.dex) >= abilityMod(data.abilities.str)
      ? "dex"
      : "str";
  }
  if (w.ranged) return "dex";
  return w.ability;
}

export function weaponAttackBonus(data: DndPlayData, w: DndWeapon): number {
  const pb = proficiencyBonus(totalLevel(data));
  const abi = weaponAbility(data, w);
  return (
    abilityMod(data.abilities[abi]) +
    (w.proficient ? pb : 0) +
    (Number(w.magic) || 0)
  );
}

export function weaponDamageBonus(data: DndPlayData, w: DndWeapon): number {
  const abi = weaponAbility(data, w);
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
  const items = data.items.reduce(
    (s, it) => s + (Number(it.weight) || 0) * (Number(it.qty) || 1),
    0
  );
  const weapons = data.weapons.reduce((s, w) => s + (Number(w.weight) || 0), 0);
  return items + weapons;
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

function emptyProfs(): DndProfs {
  return {
    race: { ...EMPTY_PROF },
    class: { ...EMPTY_PROF },
    background: { ...EMPTY_PROF },
  };
}

export function emptySpell(level = 0): DndSpell {
  return {
    id: uid(),
    name: "",
    level,
    prepared: level === 0,
    school: "",
    castingTime: "1 个动作",
    range: "",
    duration: "即效",
    effect: "",
    concentration: false,
    ritual: false,
    v: true,
    s: false,
    m: false,
    materials: "",
  };
}

function normalizeSpell(raw: Partial<DndSpell> & { notes?: string }): DndSpell {
  const base = emptySpell(Number(raw.level) || 0);
  return {
    ...base,
    ...raw,
    id: raw.id || base.id,
    name: raw.name || "",
    level: Math.max(0, Math.min(9, Number(raw.level) || 0)),
    prepared: !!raw.prepared,
    school: raw.school || "",
    castingTime: raw.castingTime || base.castingTime,
    range: raw.range || "",
    duration: raw.duration || base.duration,
    effect: raw.effect || raw.notes || "",
    concentration: !!raw.concentration,
    ritual: !!raw.ritual,
    v: raw.v !== undefined ? !!raw.v : true,
    s: !!raw.s,
    m: !!raw.m,
    materials: raw.materials || "",
  };
}

function normalizeWeapon(raw: Partial<DndWeapon>): DndWeapon {
  return {
    id: raw.id || uid(),
    name: raw.name || "武器",
    ability: (raw.ability as AbilityId) || "str",
    proficient: raw.proficient !== false,
    finesse: !!raw.finesse,
    ranged: !!raw.ranged,
    magic: Number(raw.magic) || 0,
    dmgCount: Number(raw.dmgCount) || 1,
    dmgFaces: Number(raw.dmgFaces) || 6,
    dmgBonus: Number(raw.dmgBonus) || 0,
    dmgType: raw.dmgType || "挥砍",
    range: raw.range || "5",
    notes: raw.notes || "",
    weight: Number(raw.weight) || 0,
  };
}

function normalizeProf(raw?: Partial<DndProfSource>): DndProfSource {
  return { ...EMPTY_PROF, ...(raw || {}) };
}

export function emptyResource(name = "激励骰"): DndResource {
  return { id: uid(), name, value: "", remaining: 0 };
}

export function emptyCondition(name = ""): DndCondition {
  return { id: uid(), name, notes: "" };
}

function normalizeResource(raw: Partial<DndResource>): DndResource {
  return {
    id: raw.id || uid(),
    name: raw.name || "",
    value: raw.value || "",
    remaining: Number(raw.remaining) || 0,
  };
}

function normalizeCondition(raw: Partial<DndCondition>): DndCondition {
  return {
    id: raw.id || uid(),
    name: raw.name || "",
    notes: raw.notes || "",
  };
}

function padDeath(raw?: boolean[]): boolean[] {
  return [0, 1, 2].map((i) => !!(raw && raw[i]));
}

function normalizeSlots9(raw?: number[], fallback?: number[]): number[] {
  const src = Array.isArray(raw) ? raw : Array.isArray(fallback) ? fallback : [];
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 9; i++) out[i] = Number(src[i]) || 0;
  return out;
}

export function normalizePanelOrder(raw?: PanelId[]): PanelId[] {
  const valid = new Set<PanelId>(DEFAULT_PANEL_ORDER);
  const seen = new Set<PanelId>();
  const out: PanelId[] = [];
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (valid.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  for (const id of DEFAULT_PANEL_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
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
        weight: 1,
      },
    ],
    items: [],
    spellcastingOn: false,
    spellAbility: "cha",
    spellAbility2: "",
    spellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactSlotLevel: 0,
    spells: [],
    features: [],
    featuresRace: [],
    featuresClass: [],
    languages: "",
    proficiencies: "",
    profs: emptyProfs(),
    panelWidth: { ...DEFAULT_PANEL_WIDTH },
    panelOrder: [...DEFAULT_PANEL_ORDER],
    resources: [],
    conditions: [],
    spellSlotsLeft: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

export function parseDndPlay(raw: unknown): DndPlayData {
  const d = defaultDndPlay();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Partial<DndPlayData> & { spells?: Array<Partial<DndSpell> & { notes?: string }> };
  const profs: DndProfs = {
    race: normalizeProf(o.profs?.race),
    class: normalizeProf(o.profs?.class),
    background: normalizeProf(o.profs?.background),
  };
  if (!o.profs) {
    if (o.languages) profs.race.languages = o.languages;
    if (o.proficiencies) profs.class.tools = o.proficiencies;
  }
  const featuresClass = Array.isArray(o.featuresClass)
    ? o.featuresClass
    : Array.isArray(o.features)
      ? o.features
      : [];
  const panelWidth = { ...DEFAULT_PANEL_WIDTH, ...(o.panelWidth || {}) };
  const spellSlots = normalizeSlots9(o.spellSlots, d.spellSlots);
  let resources: DndResource[] = Array.isArray(o.resources)
    ? o.resources.map(normalizeResource)
    : [];
  if (!resources.length && Number(o.inspiration) > 0) {
    resources = [
      { id: uid(), name: "激励骰", value: "1d6", remaining: Number(o.inspiration) || 0 },
    ];
  }
  return {
    ...d,
    ...o,
    abilities: { ...d.abilities, ...(o.abilities || {}) },
    saveProf: { ...d.saveProf, ...(o.saveProf || {}) },
    skills: { ...d.skills, ...(o.skills || {}) },
    classes: Array.isArray(o.classes) && o.classes.length ? o.classes : d.classes,
    weapons: Array.isArray(o.weapons) ? o.weapons.map(normalizeWeapon) : d.weapons,
    items: Array.isArray(o.items) ? o.items : d.items,
    spells: Array.isArray(o.spells) ? o.spells.map(normalizeSpell) : d.spells,
    features: featuresClass,
    featuresRace: Array.isArray(o.featuresRace) ? o.featuresRace : [],
    featuresClass,
    spellSlots,
    spellSlotsLeft: normalizeSlots9(o.spellSlotsLeft, spellSlots),
    deathSuccess: padDeath(o.deathSuccess),
    deathFail: padDeath(o.deathFail),
    pactSlotLevel: Number(o.pactSlotLevel) || 0,
    profs,
    panelWidth,
    panelOrder: normalizePanelOrder(o.panelOrder),
    resources,
    conditions: Array.isArray(o.conditions) ? o.conditions.map(normalizeCondition) : [],
  };
}

export function wrapPlay(data: DndPlayData) {
  return { system: "dnd5e", version: 1, data };
}
