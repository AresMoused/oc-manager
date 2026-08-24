"use client";

import { useState, type ReactNode } from "react";
import type { Character } from "@/lib/types";
import { useWorlds } from "@/hooks/useWorlds";
import { FreeDiceButton, useOpenCheck } from "@/systems/check/CheckHost";
import type { CheckRequest } from "@/systems/check/CheckPanel";
import {
  applyCheckConditions,
  conditionDef,
  effectiveSpeed,
  exhaustionLevel,
  speedLockedBy,
} from "./conditions";
import { DEFAULT_SPELL_PRESETS, spellFromPreset } from "./spellPresets";
import {
  ABILITIES,
  CONDITION_PRESETS,
  DAMAGE_MAGICAL,
  DAMAGE_PHYSICAL,
  DAMAGE_TYPES,
  DEFAULT_PANEL_ORDER,
  DEFAULT_PANEL_WIDTH,
  EMPTY_PROF,
  PANEL_TITLE,
  RESOURCE_PRESETS,
  SKILLS,
  SKILL_PROF_MODES,
  SPELL_LEVEL_LABELS,
  SPELL_SCHOOLS,
  WEAPON_PROP_DEFS,
  abilityMod,
  applyIncomingDamage,
  armorClass,
  abilityCheckBonus,
  carryingCap,
  currentWeight,
  emptyCondition,
  emptyResource,
  emptySpell,
  emptyWeapon,
  halfProficiency,
  initiativeBonus,
  parseDndPlay,
  passiveSkill,
  proficiencyBonus,
  saveBonus,
  signed,
  skillBonus,
  skillProfMode,
  spellAttack,
  spellSaveDc,
  totalLevel,
  withSkillProfMode,
  weaponActiveProps,
  weaponAttackBonus,
  weaponAttackBreakdown,
  weaponDamageParts,
  wrapPlay,
  type AbilityId,
  type DndCondition,
  type DndFeature,
  type DndItem,
  type DndPlayData,
  type DndProfSource,
  type DndResource,
  type DndSpell,
  type DndSpellPreset,
  type DndWeapon,
  type PanelId,
  type PanelWidth,
} from "./schema";

const inp =
  "bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 disabled:opacity-70";

export default function DndRuleSheet({
  character,
  onChange,
  onMeta,
  editable,
  canWrite: canWriteProp,
}: {
  character: Character;
  onChange: (play: Character["play"]) => void;
  onMeta?: (p: Partial<Character>) => void;
  editable: boolean;
  canWrite?: boolean;
}) {
  const openRaw = useOpenCheck();
  const d = parseDndPlay(character.play?.data);
  const open = (req: CheckRequest) => openRaw(applyCheckConditions(d, req));
  const commit = (next: DndPlayData) => onChange(wrapPlay(next));
  const patch = (p: Partial<DndPlayData>) => commit({ ...d, ...p });
  const layoutEdit = editable;
  const canWrite = canWriteProp ?? editable;
  const { getWorldByName } = useWorlds();
  const worldPresets =
    getWorldByName(character.world || "")?.spellPresets || [];
  const spellPresets = worldPresets.length ? worldPresets : DEFAULT_SPELL_PRESETS;
  const lv = totalLevel(d);
  const pb = proficiencyBonus(lv);
  const ac = armorClass(d);
  const order = d.panelOrder?.length ? d.panelOrder : DEFAULT_PANEL_ORDER;
  const widthOf = (id: PanelId): PanelWidth =>
    d.panelWidth?.[id] || DEFAULT_PANEL_WIDTH[id];
  const toggleWidth = (id: PanelId) =>
    patch({
      panelWidth: {
        ...DEFAULT_PANEL_WIDTH,
        ...d.panelWidth,
        [id]: widthOf(id) === "full" ? "half" : "full",
      },
    });
  const movePanel = (id: PanelId, dir: -1 | 1) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ panelOrder: next });
  };

  const wrapPanel = (id: PanelId, extra: ReactNode | undefined, body: ReactNode) => (
    <Panel
      key={id}
      title={PANEL_TITLE[id]}
      width={widthOf(id)}
      editable={layoutEdit}
      onWidth={() => toggleWidth(id)}
      onMoveUp={() => movePanel(id, -1)}
      onMoveDown={() => movePanel(id, 1)}
      canMoveUp={order.indexOf(id) > 0}
      canMoveDown={order.indexOf(id) < order.length - 1}
      extra={extra}
    >
      {body}
    </Panel>
  );

  const renderPanel = (id: PanelId) => {
    switch (id) {
      case "level":
        return wrapPanel(
          id,
          <span className="text-xs text-neutral-500">总等级 {lv}</span>,
          <div className="space-y-2">
            {d.classes.map((cl, i) => (
              <div key={i} className="flex gap-1 items-center">
                <span className="text-[10px] text-neutral-500 w-6">
                  {["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"][i] || i + 1}
                </span>
                <input
                  disabled={!layoutEdit}
                  className={`${inp} flex-1`}
                  placeholder="职业"
                  value={cl.name}
                  onChange={(e) => {
                    const classes = d.classes.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    );
                    patch({ classes });
                  }}
                />
                <label className="text-[10px] text-neutral-500 flex items-center gap-1">
                  等级
                  <input
                    disabled={!layoutEdit}
                    type="number"
                    min={1}
                    className={`${inp} w-14`}
                    value={cl.level}
                    onChange={(e) => {
                      const classes = d.classes.map((x, j) =>
                        j === i ? { ...x, level: Number(e.target.value) || 1 } : x
                      );
                      patch({ classes });
                    }}
                  />
                </label>
                {layoutEdit && d.classes.length > 1 && (
                  <Del onClick={() => patch({ classes: d.classes.filter((_, j) => j !== i) })} />
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {layoutEdit && d.classes.length < 5 && (
                <button
                  type="button"
                  className="text-xs text-cyan-300"
                  onClick={() =>
                    patch({ classes: [...d.classes, { name: "", level: 1 }] })
                  }
                >
                  + 兼职
                </button>
              )}
              <Num
                label="经验"
                value={d.xp}
                editable={layoutEdit}
                onChange={(xp) => patch({ xp })}
              />
              <span className="text-xs text-neutral-400">
                熟练 {signed(pb)} / 半 {signed(halfProficiency(lv))}
              </span>
            </div>
          </div>
        );

      case "abilities":
        return wrapPanel(
          id,
          undefined,
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ABILITIES.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1.5"
              >
                <span className="w-8 text-xs text-neutral-400">{a.label}</span>
                <input
                  disabled={!layoutEdit}
                  type="number"
                  className="w-12 bg-transparent border-b border-neutral-700 text-center"
                  value={d.abilities[a.id]}
                  onChange={(e) =>
                    patch({
                      abilities: {
                        ...d.abilities,
                        [a.id]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
                <Roll
                  hide={layoutEdit}
                  className="text-rose-400 font-bold w-8"
                  onClick={() =>
                    open({
                      title: `${a.label}检定`,
                      baseBonus: abilityCheckBonus(d, a.id),
                      kind: "check",
                      ability: a.id,
                      breakdown: d.jackOfAllTrades
                        ? `调整值 ${signed(abilityMod(d.abilities[a.id]))} + 一半熟练`
                        : `调整值 ${signed(abilityMod(d.abilities[a.id]))}`,
                    })
                  }
                >
                  {signed(abilityCheckBonus(d, a.id))}
                </Roll>
                <label className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <input
                    type="checkbox"
                    disabled={!layoutEdit}
                    checked={!!d.saveProf[a.id]}
                    onChange={(e) =>
                      patch({
                        saveProf: { ...d.saveProf, [a.id]: e.target.checked },
                      })
                    }
                  />
                  熟练
                </label>
                <Roll
                  hide={layoutEdit}
                  className="text-cyan-300 text-xs"
                  onClick={() =>
                    open({
                      title: `${a.label}豁免`,
                      baseBonus: saveBonus(d, a.id),
                      kind: "save",
                      ability: a.id,
                    })
                  }
                >
                  {signed(saveBonus(d, a.id))}
                </Roll>
              </div>
            ))}
          </div>
        );

      case "skills":
        return wrapPanel(
          id,
          <label className="text-[10px] text-neutral-400 flex items-center gap-1">
            <input
              type="checkbox"
              disabled={!layoutEdit}
              checked={!!d.jackOfAllTrades}
              onChange={(e) => patch({ jackOfAllTrades: e.target.checked })}
            />
            万事通（一半熟练）
          </label>,
          <>
            <div className="grid sm:grid-cols-2 gap-1">
              {SKILLS.map((s) => {
                const st = d.skills[s.id];
                const mode = skillProfMode(st);
                const joatHalf = mode === "none" && d.jackOfAllTrades;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-sm px-1">
                    <Roll
                      hide={layoutEdit}
                      className="w-12 text-left font-mono text-cyan-300"
                      onClick={() =>
                        open({
                          title: s.label,
                          baseBonus: skillBonus(d, s.id),
                          kind: "check",
                          ability: s.ability,
                          skillId: s.id,
                          presetAdv: st?.adv === "none" ? "none" : st?.adv,
                          breakdown:
                            mode === "expert"
                              ? "专精（双倍熟练）"
                              : mode === "full"
                                ? "完全熟练"
                                : mode === "half" || joatHalf
                                  ? "一半熟练"
                                  : "未熟练",
                        })
                      }
                    >
                      {signed(skillBonus(d, s.id))}
                    </Roll>
                    <span className="flex-1 truncate">{s.label}</span>
                    {layoutEdit ? (
                      <select
                        className={`${inp} w-12 text-[10px] px-1 py-0.5`}
                        value={mode}
                        onChange={(e) =>
                          patch({
                            skills: {
                              ...d.skills,
                              [s.id]: withSkillProfMode(
                                st,
                                e.target.value as (typeof SKILL_PROF_MODES)[number]["id"]
                              ),
                            },
                          })
                        }
                      >
                        {SKILL_PROF_MODES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-neutral-500 w-6">
                        {mode === "none" && joatHalf
                          ? "半"
                          : SKILL_PROF_MODES.find((m) => m.id === mode)?.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 space-y-0.5">
              {[
                ["被动感知【察言观色】", passiveSkill(d, "insight")],
                ["被动感知【察觉】", passiveSkill(d, "perception")],
                ["被动智力【调查】", passiveSkill(d, "investigation")],
              ].map(([lab, n]) => (
                <div
                  key={String(lab)}
                  className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1 text-xs"
                >
                  <span className="font-mono text-cyan-300 w-8">{n}</span>
                  <span className="text-neutral-300">{lab}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1 text-xs">
                <span className="font-mono text-cyan-300 w-8">{signed(pb)}</span>
                <span className="text-neutral-300">完全熟练加值</span>
              </div>
              <div className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1 text-xs">
                <span className="font-mono text-cyan-300 w-8">
                  {signed(halfProficiency(lv))}
                </span>
                <span className="text-neutral-300">一半熟练（吟游诗人）</span>
              </div>
            </div>
          </>
        );

      case "survival":
        return wrapPanel(
          id,
          undefined,
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Num
                label="当前 HP"
                value={d.hpCurrent}
                editable={canWrite}
                onChange={(hpCurrent) => patch({ hpCurrent })}
              />
              <Num
                label="最大 HP"
                value={d.hpMax}
                editable={canWrite}
                onChange={(hpMax) => patch({ hpMax })}
              />
              <Num
                label="临时 HP"
                value={d.hpTemp}
                editable={canWrite}
                onChange={(hpTemp) => patch({ hpTemp })}
              />
              <div className="text-xs text-neutral-400 flex items-center">AC {ac}</div>
              <Num
                label="护甲基数"
                value={d.armorBase}
                editable={canWrite}
                onChange={(armorBase) => patch({ armorBase })}
              />
              <Num
                label="盾"
                value={d.shield}
                editable={canWrite}
                onChange={(shield) => patch({ shield })}
              />
              <SpeedNum
                label="步行"
                value={d.speedWalk}
                shown={effectiveSpeed(d.speedWalk, d)}
                editable={canWrite}
                onChange={(speedWalk) => patch({ speedWalk })}
              />
              <SpeedNum
                label="游泳"
                value={d.speedSwim}
                shown={effectiveSpeed(d.speedSwim, d)}
                editable={canWrite}
                onChange={(speedSwim) => patch({ speedSwim })}
              />
              <SpeedNum
                label="飞行"
                value={d.speedFly}
                shown={effectiveSpeed(d.speedFly, d)}
                editable={canWrite}
                onChange={(speedFly) => patch({ speedFly })}
              />
              <SpeedNum
                label="攀爬"
                value={d.speedClimb}
                shown={effectiveSpeed(d.speedClimb, d)}
                editable={canWrite}
                onChange={(speedClimb) => patch({ speedClimb })}
              />
            </div>
            {!!speedLockedBy(d).length && (
              <p className="text-[10px] text-amber-400">
                速度 0（{speedLockedBy(d).join("、")}）
              </p>
            )}
            {!speedLockedBy(d).length && exhaustionLevel(d) > 0 && (
              <p className="text-[10px] text-amber-400">
                力竭 {exhaustionLevel(d)} 级：速度 −{exhaustionLevel(d) * 5} 尺，d20 −
                {exhaustionLevel(d) * 2}
              </p>
            )}
            <label className="text-[10px] text-neutral-500 inline-block">
              生命骰
              <input
                disabled={!canWrite}
                className={`${inp} w-24 ml-1`}
                value={d.hitDice}
                onChange={(e) => patch({ hitDice: e.target.value })}
              />
            </label>
            <ResistBlock
              d={d}
              canWrite={canWrite}
              onChange={(p) => patch(p)}
            />
            {canWrite && (
              <HurtBox
                d={d}
                onApply={(next, note) => {
                  patch(next);
                  return note;
                }}
              />
            )}
            <div className="rounded border border-neutral-800 p-2 space-y-1.5">
              <div className="text-[11px] text-neutral-300">~死亡豁免~</div>
              <DeathMarks
                label="成功（≥10）"
                values={d.deathSuccess}
                canWrite={canWrite}
                onChange={(deathSuccess) => patch({ deathSuccess })}
              />
              <DeathMarks
                label="失败（<10）"
                values={d.deathFail}
                canWrite={canWrite}
                onChange={(deathFail) => patch({ deathFail })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-neutral-400">资源</span>
                {canWrite && (
                  <button
                    type="button"
                    className="text-[10px] text-cyan-300"
                    onClick={() =>
                      patch({ resources: [...d.resources, emptyResource()] })
                    }
                  >
                    + 资源
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {d.resources.map((r) => (
                  <ResourceCard
                    key={r.id}
                    r={r}
                    canWrite={canWrite}
                    hideDice={layoutEdit}
                    onChange={(n) =>
                      patch({
                        resources: d.resources.map((x) => (x.id === r.id ? n : x)),
                      })
                    }
                    onRemove={() =>
                      patch({ resources: d.resources.filter((x) => x.id !== r.id) })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Roll
                hide={layoutEdit}
                className="text-xs text-cyan-300"
                onClick={() =>
                  open({
                    title: "先攻",
                    baseBonus: initiativeBonus(d),
                    kind: "initiative",
                    ability: "dex",
                    breakdown: d.jackOfAllTrades
                      ? "d20 + 敏捷 + 一半熟练（万事通）"
                      : "d20 + 敏捷",
                  })
                }
              >
                先攻 {signed(initiativeBonus(d))}
              {exhaustionLevel(d) > 0
                ? `（力竭 −${exhaustionLevel(d) * 2}）`
                : ""}
              </Roll>
              <Roll
                hide={layoutEdit}
                className="text-xs text-rose-300"
                onClick={() =>
                  open({
                    title: "死亡豁免",
                    baseBonus: 0,
                    kind: "death",
                    defaultDc: 10,
                  })
                }
              >
                掷死亡豁免
              </Roll>
            </div>
          </div>
        );

      case "conditions":
        return wrapPanel(
          id,
          undefined,
          <div className="space-y-2">
            {d.conditions.map((c) => (
              <ConditionRow
                key={c.id}
                c={c}
                canWrite={canWrite}
                onChange={(n) =>
                  patch({
                    conditions: d.conditions.map((x) => (x.id === c.id ? n : x)),
                  })
                }
                onRemove={() =>
                  patch({ conditions: d.conditions.filter((x) => x.id !== c.id) })
                }
              />
            ))}
            {canWrite && (
              <div className="flex flex-wrap gap-1">
                {CONDITION_PRESETS.filter(
                  (name) => !d.conditions.some((c) => c.name === name)
                ).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white"
                    onClick={() =>
                      patch({ conditions: [...d.conditions, emptyCondition(name)] })
                    }
                  >
                    {name}
                  </button>
                ))}
                <button
                  type="button"
                  className="text-xs text-cyan-300 px-1.5 py-0.5"
                  onClick={() =>
                    patch({ conditions: [...d.conditions, emptyCondition()] })
                  }
                >
                  + 状态
                </button>
              </div>
            )}
            {!d.conditions.length && !canWrite && (
              <p className="text-xs text-neutral-600">无特殊状态</p>
            )}
          </div>
        );

      case "attacks":
        return wrapPanel(
          id,
          undefined,
          <>
            {d.weapons.map((w) => (
              <WeaponRow
                key={w.id}
                w={w}
                data={d}
                layoutEdit={layoutEdit}
                onChange={(nw) =>
                  patch({ weapons: d.weapons.map((x) => (x.id === w.id ? nw : x)) })
                }
                onRemove={() =>
                  patch({ weapons: d.weapons.filter((x) => x.id !== w.id) })
                }
              />
            ))}
            {layoutEdit && (
              <button
                type="button"
                className="text-xs text-cyan-300 mt-1"
                onClick={() =>
                  patch({
                    weapons: [...d.weapons, emptyWeapon()],
                  })
                }
              >
                + 武器
              </button>
            )}
          </>
        );

      case "gear":
        return wrapPanel(
          id,
          undefined,
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Num label="金 GP" value={d.gp} editable={layoutEdit} onChange={(gp) => patch({ gp })} />
              <Num label="银 SP" value={d.sp} editable={layoutEdit} onChange={(sp) => patch({ sp })} />
              <Num label="铜 CP" value={d.cp} editable={layoutEdit} onChange={(cp) => patch({ cp })} />
            </div>
            <p className="text-xs text-neutral-500 my-2">
              负重 {currentWeight(d).toFixed(1)} / {carryingCap(d)} 磅
            </p>
            <div className="grid grid-cols-[1fr_3.5rem_4.5rem_1fr_auto] gap-1 text-[10px] text-neutral-500 px-1">
              <span>物品名称</span>
              <span>数量</span>
              <span>重量(磅)</span>
              <span>备注</span>
              <span />
            </div>
            {d.items.map((it) => (
              <ItemRow
                key={it.id}
                it={it}
                editable={layoutEdit}
                onChange={(n) =>
                  patch({ items: d.items.map((x) => (x.id === it.id ? n : x)) })
                }
                onRemove={() =>
                  patch({ items: d.items.filter((x) => x.id !== it.id) })
                }
              />
            ))}
            {layoutEdit && (
              <button
                type="button"
                className="text-xs text-cyan-300 mt-1"
                onClick={() =>
                  patch({
                    items: [
                      ...d.items,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        qty: 1,
                        weight: 0,
                        equipped: false,
                        notes: "",
                      },
                    ],
                  })
                }
              >
                + 物品
              </button>
            )}
          </>
        );

      case "spells":
        return wrapPanel(
          id,
          <label className="text-xs text-neutral-400">
            <input
              type="checkbox"
              disabled={!layoutEdit}
              checked={d.spellcastingOn}
              onChange={(e) => patch({ spellcastingOn: e.target.checked })}
            />{" "}
            启用
          </label>,
          d.spellcastingOn ? (
            <SpellBlock
              d={d}
              layoutEdit={layoutEdit}
              canWrite={canWrite}
              patch={patch}
              presets={spellPresets}
            />
          ) : null
        );

      case "profs":
        return wrapPanel(
          id,
          undefined,
          <>
            <ProfBlock
              title="种族"
              src={d.profs.race}
              fields={["languages", "skills", "weapons", "tools"]}
              editable={layoutEdit}
              onChange={(race) => patch({ profs: { ...d.profs, race } })}
            />
            <ProfBlock
              title="职业"
              src={d.profs.class}
              fields={["languages", "skills", "weapons", "armor", "tools"]}
              editable={layoutEdit}
              onChange={(cls) => patch({ profs: { ...d.profs, class: cls } })}
            />
            <ProfBlock
              title="背景"
              src={d.profs.background}
              fields={["languages", "skills", "tools"]}
              editable={layoutEdit}
              onChange={(background) => patch({ profs: { ...d.profs, background } })}
            />
          </>
        );

      case "features":
        return wrapPanel(
          id,
          undefined,
          <>
            <FeatureList
              heading="种族 / 专长 / 背景"
              items={d.featuresRace}
              editable={layoutEdit}
              onChange={(featuresRace) => patch({ featuresRace })}
            />
            <FeatureList
              heading="职业能力"
              items={d.featuresClass}
              editable={layoutEdit}
              onChange={(featuresClass) =>
                patch({ featuresClass, features: featuresClass })
              }
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!layoutEdit && <FreeDiceButton />}
        <label className="text-xs text-neutral-400 flex items-center gap-2">
          身份
          <select
            disabled={!layoutEdit}
            className={inp}
            value={character.sheetRole || "pc"}
            onChange={(e) =>
              onMeta?.({ sheetRole: e.target.value === "npc" ? "npc" : "pc" })
            }
          >
            <option value="pc">玩家</option>
            <option value="npc">NPC</option>
          </select>
        </label>
        {character.sheetRole !== "npc" && (
          <input
            disabled={!layoutEdit}
            className={inp}
            placeholder="玩家名"
            value={character.playerName || ""}
            onChange={(e) => onMeta?.({ playerName: e.target.value })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {order.map((id) => renderPanel(id))}
      </div>
    </div>
  );
}

function Panel({
  title,
  width,
  editable,
  onWidth,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  extra,
  children,
}: {
  title: string;
  width: PanelWidth;
  editable: boolean;
  onWidth: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2 ${
        width === "full" ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-white font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          {extra}
          {editable && (
            <>
              <button
                type="button"
                disabled={!canMoveUp}
                className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-30"
                onClick={onMoveUp}
              >
                上移
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-30"
                onClick={onMoveDown}
              >
                下移
              </button>
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white"
                onClick={onWidth}
              >
                {width === "full" ? "半宽" : "全宽"}
              </button>
            </>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Roll({
  hide,
  className,
  onClick,
  children,
}: {
  hide: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  if (hide) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-rose-400 hover:text-rose-300 text-xs shrink-0 px-1"
      onClick={onClick}
    >
      删除
    </button>
  );
}

function Num({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  editable: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="text-xs text-neutral-500 space-y-0.5">
      <span className="block">{label}</span>
      <input
        disabled={!editable}
        type="number"
        className={`${inp} w-full`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function DeathMarks({
  label,
  values,
  canWrite,
  onChange,
}: {
  label: string;
  values: boolean[];
  canWrite: boolean;
  onChange: (v: boolean[]) => void;
}) {
  const v = [0, 1, 2].map((i) => !!values[i]);
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
      <span className="w-[5.5rem]">{label}</span>
      {v.map((on, i) => (
        <input
          key={i}
          type="checkbox"
          disabled={!canWrite}
          checked={on}
          className="accent-rose-400"
          onChange={(e) => {
            const next = [...v];
            next[i] = e.target.checked;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function ResourceCard({
  r,
  canWrite,
  hideDice,
  onChange,
  onRemove,
}: {
  r: DndResource;
  canWrite: boolean;
  hideDice: boolean;
  onChange: (r: DndResource) => void;
  onRemove: () => void;
}) {
  const open = useOpenCheck();
  const preset = (RESOURCE_PRESETS as readonly string[]).includes(r.name)
    ? r.name
    : "__custom__";
  const diceMatch = /^(\d+)d(\d+)$/i.exec(r.value.trim());

  return (
    <div className="border border-neutral-800 rounded p-2 space-y-1">
      <div className="flex items-center gap-1">
        {canWrite ? (
          <select
            className={`${inp} flex-1`}
            value={preset}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...r, name: v === "__custom__" ? "" : v });
            }}
          >
            {RESOURCE_PRESETS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__custom__">自定义</option>
          </select>
        ) : (
          <span className="flex-1 text-xs text-neutral-300">{r.name || "资源"}</span>
        )}
        {canWrite && <Del onClick={onRemove} />}
      </div>
      {canWrite && preset === "__custom__" && (
        <input
          className={inp}
          placeholder="资源名称"
          value={r.name}
          onChange={(e) => onChange({ ...r, name: e.target.value })}
        />
      )}
      <div className="flex items-center gap-2">
        {canWrite ? (
          <input
            className={`${inp} flex-1`}
            placeholder="1d6 / 2"
            value={r.value}
            onChange={(e) => onChange({ ...r, value: e.target.value })}
          />
        ) : (
          <span className="flex-1 font-mono text-sm">{r.value || "—"}</span>
        )}
        {!hideDice && diceMatch && (
          <button
            type="button"
            className="text-[10px] text-amber-300"
            onClick={() =>
              open({
                title: r.name || "资源",
                baseBonus: 0,
                kind: "damage",
                damageCount: Number(diceMatch[1]) || 1,
                damageFaces: Number(diceMatch[2]) || 6,
                damageBonus: 0,
              })
            }
          >
            掷
          </button>
        )}
      </div>
      <label className="text-[10px] text-neutral-500 flex items-center gap-1">
        剩余次数
        <input
          disabled={!canWrite}
          type="number"
          min={0}
          className={`${inp} w-14`}
          value={r.remaining}
          onChange={(e) => onChange({ ...r, remaining: Number(e.target.value) || 0 })}
        />
      </label>
    </div>
  );
}

function SpeedNum({
  label,
  value,
  shown,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  shown: number;
  editable: boolean;
  onChange: (n: number) => void;
}) {
  const changed = shown !== value;
  return (
    <label className="text-xs text-neutral-500 space-y-0.5">
      <span className="block">
        {label}
        {changed && (
          <span className="text-amber-400 ml-1">实际 {shown}</span>
        )}
      </span>
      <input
        disabled={!editable}
        type="number"
        className={`${inp} w-full`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function ConditionRow({
  c,
  canWrite,
  onChange,
  onRemove,
}: {
  c: DndCondition;
  canWrite: boolean;
  onChange: (c: DndCondition) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const preset = (CONDITION_PRESETS as readonly string[]).includes(c.name)
    ? c.name
    : "__custom__";
  const def = conditionDef(c.name);
  const exLv = c.name === "力竭" ? Math.min(6, Number(c.level) || 1) : 0;

  return (
    <div className="border border-neutral-800 rounded p-2 space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex-1 text-left text-sm text-neutral-200 hover:text-white min-w-0"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-medium">{c.name || "自定义状态"}</span>
          {c.name === "力竭" && (
            <span className="text-[10px] text-amber-300 ml-1">{exLv} 级</span>
          )}
          <span className="text-[10px] text-neutral-500 ml-2">
            {open ? "收起" : "简介"}
          </span>
        </button>
        {canWrite && <Del onClick={onRemove} />}
      </div>
      {open && (
        <div className="text-xs text-neutral-400 space-y-1 bg-neutral-950 rounded p-2">
          <p className="text-neutral-200">{def?.summary || "自定义状态，不会自动改数值。"}</p>
          {def?.bullets.map((b) => (
            <p key={b}>· {b}</p>
          ))}
          {c.name === "力竭" && (
            <p className="text-amber-300">
              当前：d20 −{exLv * 2}，速度 −{exLv * 5} 尺
              {exLv >= 6 ? "；6 级死亡" : ""}
            </p>
          )}
        </div>
      )}
      {canWrite && (
        <>
          <select
            className={`${inp} w-full`}
            value={preset}
            onChange={(e) => {
              const v = e.target.value;
              const name = v === "__custom__" ? "" : v;
              onChange({
                ...c,
                name,
                level: name === "力竭" ? c.level || 1 : 0,
              });
            }}
          >
            {CONDITION_PRESETS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__custom__">自定义</option>
          </select>
          {preset === "__custom__" && (
            <input
              className={inp}
              placeholder="状态名称"
              value={c.name}
              onChange={(e) => onChange({ ...c, name: e.target.value, level: 0 })}
            />
          )}
          {c.name === "力竭" && (
            <label className="text-[10px] text-neutral-500 flex items-center gap-1">
              力竭等级
              <input
                type="number"
                min={1}
                max={6}
                className={`${inp} w-14`}
                value={exLv}
                onChange={(e) =>
                  onChange({
                    ...c,
                    level: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                  })
                }
              />
              / 6
            </label>
          )}
          <input
            className={inp}
            placeholder="备注（来源 / 持续时间）"
            value={c.notes}
            onChange={(e) => onChange({ ...c, notes: e.target.value })}
          />
        </>
      )}
      {!canWrite && c.notes && (
        <p className="text-[11px] text-neutral-500">{c.notes}</p>
      )}
    </div>
  );
}

function ItemRow({
  it,
  editable,
  onChange,
  onRemove,
}: {
  it: DndItem;
  editable: boolean;
  onChange: (it: DndItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_3.5rem_4.5rem_1fr_auto] gap-1 items-center">
      <input
        disabled={!editable}
        className={inp}
        placeholder="物品名称"
        value={it.name}
        onChange={(e) => onChange({ ...it, name: e.target.value })}
      />
      <input
        disabled={!editable}
        type="number"
        title="数量"
        className={inp}
        value={it.qty}
        onChange={(e) => onChange({ ...it, qty: Number(e.target.value) || 0 })}
      />
      <input
        disabled={!editable}
        type="number"
        step="0.1"
        title="重量（磅）"
        className={inp}
        value={it.weight}
        onChange={(e) => onChange({ ...it, weight: Number(e.target.value) || 0 })}
      />
      <input
        disabled={!editable}
        className={inp}
        placeholder="备注"
        value={it.notes}
        onChange={(e) => onChange({ ...it, notes: e.target.value })}
      />
      {editable ? <Del onClick={onRemove} /> : <span />}
    </div>
  );
}

function WeaponRow({
  w,
  data,
  layoutEdit,
  onChange,
  onRemove,
}: {
  w: DndWeapon;
  data: DndPlayData;
  layoutEdit: boolean;
  onChange: (w: DndWeapon) => void;
  onRemove: () => void;
}) {
  const openRaw = useOpenCheck();
  const open = (req: CheckRequest) => openRaw(applyCheckConditions(data, req));
  const atk = weaponAttackBonus(data, w);
  const parts = weaponDamageParts(data, w);
  const formula = weaponAttackBreakdown(data, w);
  const dmgLabel = parts
    .map(
      (p) =>
        `${p.count}d${p.faces}${p.bonus ? signed(p.bonus) : ""}${p.type ? ` ${p.type}` : ""}`
    )
    .join(" + ");

  const hitBtn = (
    <button
      type="button"
      className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 text-xs"
      onClick={() =>
        open({
          title: `${w.name} 命中`,
          baseBonus: atk,
          kind: "attack",
          dcLabel: "AC",
          breakdown: formula,
        })
      }
    >
      命中 {signed(atk)}
    </button>
  );
  const dmgBtn = (
    <button
      type="button"
      className="px-2 py-0.5 rounded bg-amber-950 text-amber-200 text-xs"
      onClick={() =>
        open({
          title: `${w.name} 伤害`,
          baseBonus: 0,
          kind: "damage",
          damageParts: parts,
        })
      }
    >
      伤害 {dmgLabel}
    </button>
  );

  if (!layoutEdit) {
    const props = weaponActiveProps(w);
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm border border-neutral-800 rounded p-2 mb-1">
        <span className="flex-1 min-w-[80px]">{w.name}</span>
        {hitBtn}
        {dmgBtn}
        <span className="text-[10px] text-neutral-500">{w.range}</span>
        {props.map((p) => (
          <span key={p} className="text-[10px] px-1 rounded bg-neutral-900 text-neutral-400">
            {p}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 rounded p-2 space-y-2 text-sm mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inp} flex-1 min-w-[100px]`}
          value={w.name}
          onChange={(e) => onChange({ ...w, name: e.target.value })}
          placeholder="武器名称"
        />
        <Del onClick={onRemove} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-[10px] text-neutral-500">
          属性
          <select
            className={`${inp} w-full mt-0.5`}
            value={w.ability}
            onChange={(e) => onChange({ ...w, ability: e.target.value as AbilityId })}
          >
            {ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-neutral-500">
          伤害骰
          <div className="flex gap-1 mt-0.5">
            <input
              type="number"
              min={1}
              className={`${inp} w-12`}
              value={w.dmgCount}
              onChange={(e) => onChange({ ...w, dmgCount: Number(e.target.value) || 1 })}
            />
            <span className="self-center text-neutral-500">d</span>
            <input
              type="number"
              min={2}
              className={`${inp} w-12`}
              value={w.dmgFaces}
              onChange={(e) => onChange({ ...w, dmgFaces: Number(e.target.value) || 4 })}
            />
          </div>
        </label>
        <label className="text-[10px] text-neutral-500">
          命中加值
          <input
            type="number"
            className={`${inp} w-full mt-0.5`}
            value={w.atkBonus || 0}
            onChange={(e) => onChange({ ...w, atkBonus: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-[10px] text-neutral-500">
          伤害加值
          <input
            type="number"
            className={`${inp} w-full mt-0.5`}
            value={w.dmgBonus}
            onChange={(e) => onChange({ ...w, dmgBonus: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-[10px] text-neutral-500">
          魔法加值
          <input
            type="number"
            className={`${inp} w-full mt-0.5`}
            value={w.magic}
            onChange={(e) => onChange({ ...w, magic: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-[10px] text-neutral-500">
          物理伤害
          <select
            className={`${inp} w-full mt-0.5`}
            value={w.dmgTypePhys || ""}
            onChange={(e) =>
              onChange({
                ...w,
                dmgTypePhys: e.target.value,
                dmgType: e.target.value || w.dmgTypeMagic,
              })
            }
          >
            <option value="">无</option>
            {DAMAGE_PHYSICAL.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-neutral-500">
          魔法伤害
          <select
            className={`${inp} w-full mt-0.5`}
            value={w.dmgTypeMagic || ""}
            onChange={(e) =>
              onChange({
                ...w,
                dmgTypeMagic: e.target.value,
                dmgType: w.dmgTypePhys || e.target.value,
                magicDmgCount:
                  e.target.value && w.dmgTypePhys && !w.magicDmgCount
                    ? 1
                    : w.magicDmgCount,
              })
            }
          >
            <option value="">无</option>
            {DAMAGE_MAGICAL.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-neutral-500">
          距离
          <input
            className={`${inp} w-full mt-0.5`}
            value={w.range}
            onChange={(e) => onChange({ ...w, range: e.target.value })}
            placeholder="5"
          />
        </label>
        <label className="text-[10px] text-neutral-500">
          重量(磅)
          <input
            type="number"
            step="0.1"
            className={`${inp} w-full mt-0.5`}
            value={w.weight}
            onChange={(e) => onChange({ ...w, weight: Number(e.target.value) || 0 })}
          />
        </label>
        {w.dmgTypePhys && w.dmgTypeMagic && (
          <label className="text-[10px] text-neutral-500 col-span-2">
            额外魔法骰（{w.dmgTypeMagic}）
            <div className="flex gap-1 mt-0.5">
              <input
                type="number"
                min={0}
                className={`${inp} w-12`}
                value={w.magicDmgCount || 0}
                onChange={(e) =>
                  onChange({ ...w, magicDmgCount: Number(e.target.value) || 0 })
                }
              />
              <span className="self-center">d</span>
              <input
                type="number"
                min={2}
                className={`${inp} w-12`}
                value={w.magicDmgFaces || 6}
                onChange={(e) =>
                  onChange({ ...w, magicDmgFaces: Number(e.target.value) || 6 })
                }
              />
              <span className="self-center text-neutral-500">+</span>
              <input
                type="number"
                className={`${inp} w-12`}
                value={w.magicDmgBonus || 0}
                onChange={(e) =>
                  onChange({ ...w, magicDmgBonus: Number(e.target.value) || 0 })
                }
              />
            </div>
          </label>
        )}
        <label className="text-[10px] text-neutral-500 col-span-2">
          备注
          <input
            className={`${inp} w-full mt-0.5`}
            value={w.notes}
            onChange={(e) => onChange({ ...w, notes: e.target.value })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-neutral-400">
        {WEAPON_PROP_DEFS.map((p) => (
          <label key={p.id} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!w[p.id]}
              onChange={(e) => {
                const on = e.target.checked;
                const next = { ...w, [p.id]: on } as DndWeapon;
                if (p.id === "ranged" && on && !w.finesse && w.ability === "str") {
                  next.ability = "dex";
                }
                onChange(next);
              }}
            />
            {p.label}
          </label>
        ))}
        <span className="text-neutral-500">{formula}</span>
      </div>
    </div>
  );
}

function SpellBlock({
  d,
  layoutEdit,
  canWrite,
  patch,
  presets,
}: {
  d: DndPlayData;
  layoutEdit: boolean;
  canWrite: boolean;
  patch: (p: Partial<DndPlayData>) => void;
  presets: DndSpellPreset[];
}) {
  const openRaw = useOpenCheck();
  const open = (req: CheckRequest) => openRaw(applyCheckConditions(d, req));
  const slots = [...d.spellSlots];
  while (slots.length < 9) slots.push(0);
  const left = [...(d.spellSlotsLeft || [])];
  while (left.length < 9) left.push(0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm items-center">
        <span className="text-neutral-500 text-xs">职业Ⅰ 主属性</span>
        <select
          disabled={!layoutEdit}
          className={inp}
          value={d.spellAbility}
          onChange={(e) => patch({ spellAbility: e.target.value as AbilityId })}
        >
          {ABILITIES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <Roll
          hide={layoutEdit}
          className="text-cyan-300 text-xs"
          onClick={() =>
            open({
              title: "职业Ⅰ 法术攻击",
              baseBonus: spellAttack(d, d.spellAbility),
              kind: "attack",
              ability: d.spellAbility,
              dcLabel: "AC",
            })
          }
        >
          职业Ⅰ DC {spellSaveDc(d, d.spellAbility)} / 攻击{" "}
          {signed(spellAttack(d, d.spellAbility))}
        </Roll>
        <span className="text-neutral-500 text-xs">职业Ⅱ</span>
        <select
          disabled={!layoutEdit}
          className={inp}
          value={d.spellAbility2}
          onChange={(e) =>
            patch({ spellAbility2: (e.target.value || "") as AbilityId | "" })
          }
        >
          <option value="">无</option>
          {ABILITIES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {d.spellAbility2 && (
          <Roll
            hide={layoutEdit}
            className="text-cyan-300 text-xs"
            onClick={() =>
              open({
                title: "职业Ⅱ 法术攻击",
                baseBonus: spellAttack(d, d.spellAbility2 as AbilityId),
                kind: "attack",
                ability: d.spellAbility2 as AbilityId,
                dcLabel: "AC",
              })
            }
          >
            职业Ⅱ DC {spellSaveDc(d, d.spellAbility2 as AbilityId)} / 攻击{" "}
            {signed(spellAttack(d, d.spellAbility2 as AbilityId))}
          </Roll>
        )}
      </div>

      <div>
        <div className="text-[10px] text-neutral-500 mb-1">每日法术位（剩余 / 上限）</div>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1">
          {SPELL_LEVEL_LABELS.slice(1).map((lab, i) => (
            <div key={lab} className="text-[10px] text-neutral-500">
              {lab}
              <div className="flex items-center gap-0.5 mt-0.5">
                <input
                  disabled={!canWrite}
                  type="number"
                  min={0}
                  title="剩余"
                  className={`${inp} w-full`}
                  value={left[i] || 0}
                  onChange={(e) => {
                    const next = [...left];
                    next[i] = Number(e.target.value) || 0;
                    patch({ spellSlotsLeft: next });
                  }}
                />
                <span>/</span>
                <input
                  disabled={!layoutEdit}
                  type="number"
                  min={0}
                  title="上限"
                  className={`${inp} w-full`}
                  value={slots[i] || 0}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = Number(e.target.value) || 0;
                    patch({ spellSlots: next });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <label className="text-[10px] text-neutral-500 inline-block mt-2">
          契约魔法环阶
          <input
            disabled={!layoutEdit}
            type="number"
            min={0}
            max={9}
            className={`${inp} w-16 ml-1`}
            value={d.pactSlotLevel}
            onChange={(e) => patch({ pactSlotLevel: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      {SPELL_LEVEL_LABELS.map((lab, lv) => {
        const list = d.spells.filter((s) => s.level === lv);
        return (
          <div key={lv} className="border-t border-neutral-800 pt-2">
            <div className="flex items-center justify-between mb-1 gap-2">
              <h4 className="text-xs text-neutral-300">{lab}</h4>
              {layoutEdit && (
                <div className="flex items-center gap-2">
                  <PresetPull
                    presets={presets.filter((p) => p.level === lv)}
                    onPick={(p) =>
                      patch({ spells: [...d.spells, spellFromPreset(p)] })
                    }
                  />
                  <button
                    type="button"
                    className="text-[10px] text-cyan-300"
                    onClick={() => patch({ spells: [...d.spells, emptySpell(lv)] })}
                  >
                    + {lab}法术
                  </button>
                </div>
              )}
            </div>
            {list.map((sp) => (
              <SpellRow
                key={sp.id}
                sp={sp}
                d={d}
                layoutEdit={layoutEdit}
                canWrite={canWrite}
                onChange={(n) =>
                  patch({ spells: d.spells.map((x) => (x.id === sp.id ? n : x)) })
                }
                onRemove={() =>
                  patch({ spells: d.spells.filter((x) => x.id !== sp.id) })
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SpellRow({
  sp,
  d,
  layoutEdit,
  canWrite,
  onChange,
  onRemove,
}: {
  sp: DndSpell;
  d: DndPlayData;
  layoutEdit: boolean;
  canWrite: boolean;
  onChange: (s: DndSpell) => void;
  onRemove: () => void;
}) {
  const openRaw = useOpenCheck();
  const open = (req: CheckRequest) => openRaw(applyCheckConditions(d, req));
  const [openRow, setOpenRow] = useState(false);
  const vsm = [sp.v && "V", sp.s && "S", sp.m && "M"].filter(Boolean).join("");
  if (layoutEdit) {
    return (
      <div className="border border-neutral-800 rounded p-2 mb-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] text-neutral-500 flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.prepared}
              onChange={(e) => onChange({ ...sp, prepared: e.target.checked })}
            />
            准备
          </label>
          <input
            className={`${inp} flex-1 min-w-[120px]`}
            placeholder="法术名称"
            value={sp.name}
            onChange={(e) => onChange({ ...sp, name: e.target.value })}
          />
          <Del onClick={onRemove} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <label className="text-[10px] text-neutral-500">
            学派
            <select
              className={`${inp} w-full mt-0.5`}
              value={sp.school}
              onChange={(e) => onChange({ ...sp, school: e.target.value })}
            >
              <option value="">—</option>
              {SPELL_SCHOOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-neutral-500">
            施法时间
            <input
              className={`${inp} w-full mt-0.5`}
              value={sp.castingTime}
              onChange={(e) => onChange({ ...sp, castingTime: e.target.value })}
            />
          </label>
          <label className="text-[10px] text-neutral-500">
            射程
            <input
              className={`${inp} w-full mt-0.5`}
              value={sp.range}
              onChange={(e) => onChange({ ...sp, range: e.target.value })}
            />
          </label>
          <label className="text-[10px] text-neutral-500">
            持续时间
            <input
              className={`${inp} w-full mt-0.5`}
              value={sp.duration}
              onChange={(e) => onChange({ ...sp, duration: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-neutral-400">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.concentration}
              onChange={(e) => onChange({ ...sp, concentration: e.target.checked })}
            />
            专注
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.ritual}
              onChange={(e) => onChange({ ...sp, ritual: e.target.checked })}
            />
            仪式
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.v}
              onChange={(e) => onChange({ ...sp, v: e.target.checked })}
            />
            V
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.s}
              onChange={(e) => onChange({ ...sp, s: e.target.checked })}
            />
            S
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.m}
              onChange={(e) => onChange({ ...sp, m: e.target.checked })}
            />
            M
          </label>
        </div>
        {sp.m && (
          <input
            className={`${inp} w-full`}
            placeholder="花费材料"
            value={sp.materials}
            onChange={(e) => onChange({ ...sp, materials: e.target.value })}
          />
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <label className="text-[10px] text-neutral-400 flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.hasAttack}
              onChange={(e) => onChange({ ...sp, hasAttack: e.target.checked })}
            />
            法术攻击
          </label>
          <label className="text-[10px] text-neutral-500">
            豁免
            <select
              className={`${inp} w-full mt-0.5`}
              value={sp.saveAbility || ""}
              onChange={(e) =>
                onChange({ ...sp, saveAbility: (e.target.value || "") as AbilityId | "" })
              }
            >
              <option value="">无</option>
              {ABILITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-neutral-500">
            伤害骰
            <div className="flex gap-1 mt-0.5">
              <input
                type="number"
                min={0}
                className={`${inp} w-12`}
                value={sp.dmgCount || 0}
                onChange={(e) => onChange({ ...sp, dmgCount: Number(e.target.value) || 0 })}
              />
              <span className="self-center">d</span>
              <input
                type="number"
                min={2}
                className={`${inp} w-12`}
                value={sp.dmgFaces || 6}
                onChange={(e) => onChange({ ...sp, dmgFaces: Number(e.target.value) || 6 })}
              />
            </div>
          </label>
          <label className="text-[10px] text-neutral-500">
            伤害类型
            <DamageTypeSelect
              value={sp.dmgType || ""}
              onChange={(dmgType) => onChange({ ...sp, dmgType })}
            />
          </label>
        </div>
        <textarea
          className={`${inp} w-full min-h-[64px]`}
          placeholder="效果"
          value={sp.effect}
          onChange={(e) => onChange({ ...sp, effect: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 rounded px-2 py-1.5 mb-1 text-sm">
      <div className="w-full flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {canWrite ? (
          <label className="text-[10px] text-neutral-500 flex items-center gap-1">
            <input
              type="checkbox"
              checked={sp.prepared}
              onChange={(e) => onChange({ ...sp, prepared: e.target.checked })}
            />
          </label>
        ) : (
          <span className={sp.prepared ? "text-cyan-300" : "text-neutral-500"}>
            {sp.prepared ? "●" : "○"}
          </span>
        )}
        <button
          type="button"
          className="flex-1 text-left flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0"
          onClick={() => setOpenRow((v) => !v)}
        >
          <span className="font-medium">{sp.name || "（未命名）"}</span>
          {sp.school && <span className="text-[10px] text-neutral-500">{sp.school}</span>}
          <span className="text-[10px] text-neutral-500">{sp.castingTime}</span>
          <span className="text-[10px] text-neutral-500">{sp.range}</span>
          <span className="text-[10px] text-neutral-500">{sp.duration}</span>
          {vsm && <span className="text-[10px] text-neutral-500">{vsm}</span>}
          {sp.concentration && (
            <span className="text-[10px] text-amber-400">专注</span>
          )}
          {sp.ritual && <span className="text-[10px] text-sky-400">仪式</span>}
        </button>
        {sp.hasAttack && (
          <button
            type="button"
            className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-200 text-[10px]"
            onClick={() =>
              open({
                title: `${sp.name || "法术"} 攻击`,
                baseBonus: spellAttack(d, d.spellAbility),
                kind: "attack",
                ability: d.spellAbility,
                dcLabel: "AC",
              })
            }
          >
            攻击 {signed(spellAttack(d, d.spellAbility))}
          </button>
        )}
        {sp.saveAbility && (
          <button
            type="button"
            className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-200 text-[10px]"
            onClick={() =>
              open({
                title: `${sp.name || "法术"} ${ABILITIES.find((a) => a.id === sp.saveAbility)?.label}豁免`,
                baseBonus: 0,
                kind: "save",
                ability: sp.saveAbility,
                defaultDc: spellSaveDc(d, d.spellAbility),
                dcLabel: "DC",
              })
            }
          >
            DC {spellSaveDc(d, d.spellAbility)}
          </button>
        )}
        {sp.dmgCount > 0 && (
          <button
            type="button"
            className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-200 text-[10px]"
            onClick={() =>
              open({
                title: `${sp.name || "法术"} 伤害`,
                baseBonus: 0,
                kind: "damage",
                damageCount: sp.dmgCount,
                damageFaces: sp.dmgFaces,
                damageBonus: sp.dmgBonus,
                damageType: sp.dmgType,
              })
            }
          >
            {sp.dmgCount}d{sp.dmgFaces}
            {sp.dmgBonus ? signed(sp.dmgBonus) : ""} {sp.dmgType}
          </button>
        )}
      </div>
      {openRow && (
        <div className="mt-1 text-xs text-neutral-400 whitespace-pre-wrap">
          {sp.effect || "（无效果文本）"}
          {sp.materials ? `\n材料：${sp.materials}` : ""}
        </div>
      )}
    </div>
  );
}

const PROF_LABEL: Record<keyof DndProfSource, string> = {
  languages: "语言",
  skills: "技能",
  weapons: "武器",
  armor: "护甲",
  tools: "工具",
};

function ProfBlock({
  title,
  src,
  fields,
  editable,
  onChange,
}: {
  title: string;
  src: DndProfSource;
  fields: (keyof DndProfSource)[];
  editable: boolean;
  onChange: (s: DndProfSource) => void;
}) {
  const row = { ...EMPTY_PROF, ...src };
  return (
    <div className="mb-2">
      <h4 className="text-[11px] text-neutral-400 mb-1">{title}</h4>
      <div className="space-y-1">
        {fields.map((f) => (
          <label key={f} className="flex items-center gap-2 text-xs">
            <span className="w-10 text-neutral-500 shrink-0">{PROF_LABEL[f]}</span>
            <input
              disabled={!editable}
              className={`${inp} flex-1`}
              placeholder={`${title}${PROF_LABEL[f]}`}
              value={row[f]}
              onChange={(e) => onChange({ ...row, [f]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function FeatureList({
  heading,
  items,
  editable,
  onChange,
}: {
  heading: string;
  items: DndFeature[];
  editable: boolean;
  onChange: (items: DndFeature[]) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-[11px] text-neutral-400">{heading}</h4>
        {editable && (
          <button
            type="button"
            className="text-[10px] text-cyan-300"
            onClick={() =>
              onChange([
                ...items,
                { id: crypto.randomUUID(), name: "", uses: "", body: "" },
              ])
            }
          >
            + 条目
          </button>
        )}
      </div>
      {items.map((f) => (
        <div key={f.id} className="border border-neutral-800 rounded p-2 mb-1 space-y-1">
          <div className="flex gap-1 items-center">
            <input
              disabled={!editable}
              className={`${inp} flex-1`}
              placeholder="名称"
              value={f.name}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))
              }
            />
            <input
              disabled={!editable}
              className={`${inp} w-20`}
              placeholder="次数"
              value={f.uses}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === f.id ? { ...x, uses: e.target.value } : x)))
              }
            />
            {editable && (
              <Del onClick={() => onChange(items.filter((x) => x.id !== f.id))} />
            )}
          </div>
          <textarea
            disabled={!editable}
            className={`${inp} w-full min-h-[44px]`}
            placeholder="说明"
            value={f.body}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === f.id ? { ...x, body: e.target.value } : x)))
            }
          />
        </div>
      ))}
    </div>
  );
}

function DamageTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className={`${inp} w-full mt-0.5`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">无</option>
      <optgroup label="物理">
        {DAMAGE_PHYSICAL.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
      <optgroup label="魔法">
        {DAMAGE_MAGICAL.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
      {value && !(DAMAGE_TYPES as readonly string[]).includes(value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}

function PresetPull({
  presets,
  onPick,
}: {
  presets: DndSpellPreset[];
  onPick: (p: DndSpellPreset) => void;
}) {
  const [id, setId] = useState("");
  if (!presets.length) return null;
  return (
    <span className="flex items-center gap-1">
      <select
        className={`${inp} text-[10px] max-w-[8rem]`}
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">从预设拉取</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="text-[10px] text-cyan-300"
        disabled={!id}
        onClick={() => {
          const p = presets.find((x) => x.id === id);
          if (p) onPick(p);
          setId("");
        }}
      >
        拉取
      </button>
    </span>
  );
}

function ResistBlock({
  d,
  canWrite,
  onChange,
}: {
  d: DndPlayData;
  canWrite: boolean;
  onChange: (p: Partial<DndPlayData>) => void;
}) {
  const rows: { key: "resistances" | "immunities" | "vulnerabilities"; label: string }[] = [
    { key: "resistances", label: "抗性" },
    { key: "immunities", label: "免疫" },
    { key: "vulnerabilities", label: "易伤" },
  ];
  return (
    <div className="space-y-1">
      {rows.map((row) => {
        const list = d[row.key] || [];
        return (
          <div key={row.key} className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-neutral-500 w-8">{row.label}</span>
            {list.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!canWrite}
                className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300"
                onClick={() =>
                  onChange({ [row.key]: list.filter((x) => x !== t) })
                }
              >
                {t}
                {canWrite ? " ×" : ""}
              </button>
            ))}
            {canWrite && (
              <select
                className={`${inp} text-[10px] w-20`}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && !list.includes(v)) onChange({ [row.key]: [...list, v] });
                }}
              >
                <option value="">+</option>
                {DAMAGE_TYPES.filter((t) => !list.includes(t)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            {!list.length && !canWrite && (
              <span className="text-[10px] text-neutral-600">无</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HurtBox({
  d,
  onApply,
}: {
  d: DndPlayData;
  onApply: (next: Partial<DndPlayData>, note: string) => string;
}) {
  const [type, setType] = useState<string>("穿刺");
  const [amount, setAmount] = useState("0");
  const [log, setLog] = useState("");
  return (
    <div className="rounded border border-rose-900/50 bg-rose-950/20 p-2 space-y-1.5">
      <div className="text-[11px] text-rose-200">受伤判定（已命中）</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] text-neutral-500">
          伤害类型
          <DamageTypeSelect value={type} onChange={setType} />
        </label>
        <label className="text-[10px] text-neutral-500">
          数值
          <input
            type="number"
            min={0}
            className={`${inp} w-20 mt-0.5`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="px-2 py-1 rounded bg-rose-800 text-white text-xs"
          onClick={() => {
            const res = applyIncomingDamage(d, Number(amount) || 0, type);
            const note = onApply(
              { hpCurrent: res.hpCurrent, hpTemp: res.hpTemp },
              res.note
            );
            setLog(note);
          }}
        >
          结算
        </button>
      </div>
      {log && <p className="text-[10px] text-rose-200">{log}</p>}
    </div>
  );
}

