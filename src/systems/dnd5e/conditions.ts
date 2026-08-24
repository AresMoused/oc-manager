import type { CheckRequest } from "@/systems/check/CheckPanel";
import type { AbilityId, DndCondition, DndPlayData } from "./schema";

export type RollKind =
  | "check"
  | "save"
  | "attack"
  | "damage"
  | "free"
  | "death"
  | "initiative";

export interface ConditionDef {
  name: string;
  summary: string;
  bullets: string[];
}

export const CONDITION_DEFS: Record<string, ConditionDef> = {
  目盲: {
    name: "目盲",
    summary: "看不见。依赖视觉的检定失败；你的攻击劣势，打你的攻击优势。",
    bullets: [
      "无法看见",
      "需要视觉的属性检定自动失败",
      "你的攻击检定具有劣势",
      "以你为目标的攻击检定具有优势",
    ],
  },
  魅惑: {
    name: "魅惑",
    summary: "不能伤害魅惑你的生物；对方对你的社交检定具有优势。",
    bullets: [
      "不能攻击魅惑来源，也不能对其施加伤害或削弱效果",
      "魅惑来源对你进行的社交属性检定具有优势",
    ],
  },
  耳聋: {
    name: "耳聋",
    summary: "听不见。依赖听觉的检定失败。",
    bullets: ["无法听见", "需要听觉的属性检定自动失败"],
  },
  恐慌: {
    name: "恐慌",
    summary: "来源在视线内时，攻击和属性检定劣势，且不能主动靠近。",
    bullets: [
      "只要能看到恐慌来源，攻击检定和属性检定具有劣势",
      "不能自愿靠近恐慌来源",
    ],
  },
  受擒: {
    name: "受擒",
    summary: "速度变为 0，不能受益于速度加值。",
    bullets: [
      "速度为 0，且不能受益于任何速度加值",
      "擒抱者失能、你被移出其触及，或你挣脱时结束",
    ],
  },
  失能: {
    name: "失能",
    summary: "不能行动、反应或说话；专注中断；先攻劣势。",
    bullets: [
      "不能执行任何动作、附赠动作或反应",
      "不能说话，专注中断",
      "在失能时掷先攻具有劣势",
    ],
  },
  隐形: {
    name: "隐形",
    summary: "先攻优势。看不见你的生物：你打他优势，他打你劣势。",
    bullets: [
      "先攻检定具有优势",
      "若目标看不见你，你对其的攻击检定具有优势",
      "看不见你的生物对你的攻击检定具有劣势",
      "需要看见你才能生效的效应对你无效（除非来源仍能以某种方式看见你）",
    ],
  },
  麻痹: {
    name: "麻痹",
    summary: "失能，速度 0。力/敏豁免自动失败；近战命中必爆。",
    bullets: [
      "处于失能，速度为 0",
      "力量和敏捷豁免自动失败",
      "以你为目标的攻击检定具有优势",
      "攻击者在你 5 尺内命中时，该次攻击为重击",
    ],
  },
  石化: {
    name: "石化",
    summary: "变成固体。失能、速度 0，力/敏豁免失败；抗性全部伤害。",
    bullets: [
      "处于失能，速度为 0",
      "力量和敏捷豁免自动失败",
      "以你为目标的攻击检定具有优势",
      "对所有伤害具有抗性；免疫中毒与力竭",
    ],
  },
  中毒: {
    name: "中毒",
    summary: "攻击检定和属性检定具有劣势。",
    bullets: ["攻击检定具有劣势", "属性检定具有劣势"],
  },
  倒地: {
    name: "倒地",
    summary: "只能爬行或花半速起身。你的攻击劣势；5 尺内打你优势，否则劣势。",
    bullets: [
      "只能爬行，或消耗相当于半速的移动起身",
      "你的攻击检定具有劣势",
      "5 尺内对你的攻击检定具有优势，更远则具有劣势",
    ],
  },
  束缚: {
    name: "束缚",
    summary: "速度 0。你的攻击和敏捷豁免劣势；打你的攻击优势。",
    bullets: [
      "速度为 0，且不能受益于任何速度加值",
      "你的攻击检定具有劣势",
      "以你为目标的攻击检定具有优势",
      "敏捷豁免具有劣势",
    ],
  },
  震慑: {
    name: "震慑",
    summary: "失能。力/敏豁免自动失败；打你的攻击优势。",
    bullets: [
      "处于失能",
      "力量和敏捷豁免自动失败",
      "以你为目标的攻击检定具有优势",
    ],
  },
  昏迷: {
    name: "昏迷",
    summary: "失能并倒地。力/敏豁免失败；近战命中必爆。",
    bullets: [
      "处于失能并倒地，掉落持有物，速度为 0",
      "力量和敏捷豁免自动失败",
      "以你为目标的攻击检定具有优势",
      "攻击者在你 5 尺内命中时，该次攻击为重击",
    ],
  },
  力竭: {
    name: "力竭",
    summary: "每级：所有 d20 检定 −2，速度 −5 尺。6 级死亡。",
    bullets: [
      "进行 d20 检定（攻击、豁免、属性、先攻、死亡豁免）时，d20 结果减去 2×力竭等级",
      "速度减少 5 尺×力竭等级",
      "长休结束时力竭等级降低 1",
      "力竭 6 级时死亡",
    ],
  },
};

export function conditionDef(name: string): ConditionDef | undefined {
  return CONDITION_DEFS[name];
}

export function exhaustionLevel(data: DndPlayData): number {
  let n = 0;
  for (const c of data.conditions || []) {
    if (c.name !== "力竭") continue;
    n = Math.max(n, Math.min(6, Number(c.level) || 1));
  }
  return n;
}

const SPEED_ZERO = new Set(["受擒", "麻痹", "石化", "束缚", "昏迷"]);

export function speedLockedBy(data: DndPlayData): string[] {
  const names = new Set((data.conditions || []).map((c) => c.name));
  return [...SPEED_ZERO].filter((n) => names.has(n));
}

export function effectiveSpeed(base: number, data: DndPlayData): number {
  if (speedLockedBy(data).length) return 0;
  const ex = exhaustionLevel(data);
  return Math.max(0, (Number(base) || 0) - ex * 5);
}

export interface ConditionEval {
  adv: "none" | "adv" | "dis";
  d20Penalty: number;
  autoFail: boolean;
  warnings: string[];
}

function netAdv(hasAdv: boolean, hasDis: boolean): "none" | "adv" | "dis" {
  if (hasAdv && hasDis) return "none";
  if (hasAdv) return "adv";
  if (hasDis) return "dis";
  return "none";
}

export function evaluateConditions(
  data: DndPlayData,
  ctx: { kind: RollKind; ability?: string; skillId?: string }
): ConditionEval {
  const names = new Set((data.conditions || []).map((c) => c.name));
  const warnings: string[] = [];
  let hasAdv = false;
  let hasDis = false;
  let autoFail = false;
  const kind = ctx.kind;
  const skip = kind === "damage" || kind === "free";
  const d20 =
    !skip &&
    (kind === "check" ||
      kind === "save" ||
      kind === "attack" ||
      kind === "death" ||
      kind === "initiative");
  const ex = exhaustionLevel(data);

  if (d20 && ex) {
    warnings.push(`力竭 ${ex} 级：d20 −${ex * 2}`);
    if (ex >= 6) warnings.push("力竭 6 级：角色死亡");
  }

  const incapacitated =
    names.has("失能") ||
    names.has("麻痹") ||
    names.has("石化") ||
    names.has("震慑") ||
    names.has("昏迷");

  if (names.has("目盲")) {
    if (kind === "attack") {
      hasDis = true;
      warnings.push("目盲：你的攻击检定具有劣势");
    }
    if (kind === "check") {
      warnings.push("目盲：若此检定需要视觉则自动失败");
      if (ctx.skillId === "perception") {
        warnings.push("目盲：察觉通常依赖视觉");
      }
    }
  }

  if (names.has("耳聋") && kind === "check") {
    warnings.push("耳聋：若此检定需要听觉则自动失败");
  }

  if (names.has("魅惑") && kind === "attack") {
    warnings.push("魅惑：不能攻击魅惑来源，也不能对其造成伤害");
  }

  if (names.has("恐慌")) {
    if (kind === "attack" || kind === "check") {
      hasDis = true;
      warnings.push("恐慌：来源在视线内时攻击和属性检定具有劣势（不在视线内请改回正常）");
    }
  }

  if (names.has("隐形")) {
    if (kind === "attack") {
      hasAdv = true;
      warnings.push("隐形：若目标看不见你，攻击具有优势（对方能看见则取消）");
    }
    if (kind === "initiative") {
      hasAdv = true;
      warnings.push("隐形：先攻具有优势");
    }
  }

  if (names.has("中毒")) {
    if (kind === "attack" || kind === "check") {
      hasDis = true;
      warnings.push("中毒：攻击检定和属性检定具有劣势");
    }
  }

  if (names.has("倒地") && kind === "attack") {
    hasDis = true;
    warnings.push("倒地：你的攻击检定具有劣势");
  }

  if (names.has("束缚")) {
    if (kind === "attack") {
      hasDis = true;
      warnings.push("束缚：你的攻击检定具有劣势");
    }
    if (kind === "save" && ctx.ability === "dex") {
      hasDis = true;
      warnings.push("束缚：敏捷豁免具有劣势");
    }
  }

  if (incapacitated) {
    if (kind === "attack") {
      warnings.push("失能：不能执行攻击或其他动作");
    }
    if (kind === "initiative") {
      hasDis = true;
      warnings.push("失能：掷先攻具有劣势");
    }
  }

  const autoFailStrDex =
    names.has("麻痹") || names.has("石化") || names.has("震慑") || names.has("昏迷");
  if (autoFailStrDex && kind === "save" && (ctx.ability === "str" || ctx.ability === "dex")) {
    autoFail = true;
    const which = [...names].filter((n) =>
      ["麻痹", "石化", "震慑", "昏迷"].includes(n)
    );
    warnings.push(`${which.join("、")}：力量和敏捷豁免自动失败`);
  }

  if (names.has("受擒") && (kind === "check" || kind === "initiative")) {
    warnings.push("受擒：速度为 0");
  }

  const adv = netAdv(hasAdv, hasDis);
  if (hasAdv && hasDis) {
    warnings.push("多项状态同时给予优势与劣势，互相抵消");
  }

  return {
    adv: skip ? "none" : adv,
    d20Penalty: d20 ? ex * 2 : 0,
    autoFail,
    warnings,
  };
}

function mergeAdv(
  a: CheckRequest["presetAdv"],
  b: CheckRequest["presetAdv"]
): CheckRequest["presetAdv"] {
  const x = a || "none";
  const y = b || "none";
  if (x === "none") return y;
  if (y === "none") return x;
  if (x === y) return x;
  return "none";
}

export function applyCheckConditions(
  data: DndPlayData,
  req: CheckRequest
): CheckRequest {
  const kind = (req.kind || "check") as RollKind;
  const fx = evaluateConditions(data, {
    kind,
    ability: req.ability,
    skillId: req.skillId,
  });
  if (!fx.warnings.length && !fx.d20Penalty && fx.adv === "none" && !fx.autoFail) {
    return req;
  }
  const presetAdv = mergeAdv(req.presetAdv, fx.adv);
  const warnings = [...(req.warnings || []), ...fx.warnings];
  if (
    (req.presetAdv === "adv" && fx.adv === "dis") ||
    (req.presetAdv === "dis" && fx.adv === "adv")
  ) {
    warnings.push("技能预设与状态的优劣互相抵消");
  }
  return {
    ...req,
    presetAdv,
    d20Penalty: (req.d20Penalty || 0) + fx.d20Penalty,
    autoFail: req.autoFail || fx.autoFail,
    warnings,
  };
}

export function conditionBrief(c: DndCondition): string {
  const def = conditionDef(c.name);
  if (c.name === "力竭") {
    const lv = Math.min(6, Number(c.level) || 1);
    return `力竭 ${lv} 级：d20 −${lv * 2}，速度 −${lv * 5} 尺。${def?.summary || ""}`;
  }
  return def?.summary || c.notes || "自定义状态，无自动规则。";
}
