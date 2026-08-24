"use client";

import { useState, type ReactNode } from "react";
import type { Character } from "@/lib/types";
import { FreeDiceButton, useOpenCheck } from "@/systems/check/CheckHost";
import {
  ABILITIES,
  DEFAULT_PANEL_WIDTH,
  EMPTY_PROF,
  SKILLS,
  SPELL_LEVEL_LABELS,
  SPELL_SCHOOLS,
  abilityMod,
  armorClass,
  carryingCap,
  currentWeight,
  emptySpell,
  parseDndPlay,
  proficiencyBonus,
  saveBonus,
  signed,
  skillBonus,
  spellAttack,
  spellSaveDc,
  totalLevel,
  weaponAttackBonus,
  weaponDamageBonus,
  wrapPlay,
  type AbilityId,
  type DndFeature,
  type DndItem,
  type DndPlayData,
  type DndProfSource,
  type DndSpell,
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
}: {
  character: Character;
  onChange: (play: Character["play"]) => void;
  onMeta?: (p: Partial<Character>) => void;
  editable: boolean;
}) {
  const open = useOpenCheck();
  const d = parseDndPlay(character.play?.data);
  const commit = (next: DndPlayData) => onChange(wrapPlay(next));
  const patch = (p: Partial<DndPlayData>) => commit({ ...d, ...p });
  const lv = totalLevel(d);
  const pb = proficiencyBonus(lv);
  const ac = armorClass(d);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!editable && <FreeDiceButton />}
        <label className="text-xs text-neutral-400 flex items-center gap-2">
          身份
          <select
            disabled={!editable}
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
            disabled={!editable}
            className={inp}
            placeholder="玩家名"
            value={character.playerName || ""}
            onChange={(e) => onMeta?.({ playerName: e.target.value })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel
          title="等级"
          width={widthOf("level")}
          editable={editable}
          onWidth={() => toggleWidth("level")}
          extra={<span className="text-xs text-neutral-500">总等级 {lv}</span>}
        >
          <div className="space-y-2">
            {d.classes.map((cl, i) => (
              <div key={i} className="flex gap-1 items-center">
                <span className="text-[10px] text-neutral-500 w-6">
                  {["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"][i] || i + 1}
                </span>
                <input
                  disabled={!editable}
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
                    disabled={!editable}
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
                {editable && d.classes.length > 1 && (
                  <Del onClick={() => patch({ classes: d.classes.filter((_, j) => j !== i) })} />
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {editable && d.classes.length < 5 && (
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
                editable={editable}
                onChange={(xp) => patch({ xp })}
              />
              <span className="text-xs text-neutral-400">熟练 {signed(pb)}</span>
            </div>
          </div>
        </Panel>

        <Panel
          title="属性 / 豁免"
          width={widthOf("abilities")}
          editable={editable}
          onWidth={() => toggleWidth("abilities")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ABILITIES.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1.5"
              >
                <span className="w-8 text-xs text-neutral-400">{a.label}</span>
                <input
                  disabled={!editable}
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
                  editable={editable}
                  className="text-rose-400 font-bold w-8"
                  onClick={() =>
                    open({
                      title: `${a.label}检定`,
                      baseBonus: abilityMod(d.abilities[a.id]),
                    })
                  }
                >
                  {signed(abilityMod(d.abilities[a.id]))}
                </Roll>
                <label className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <input
                    type="checkbox"
                    disabled={!editable}
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
                  editable={editable}
                  className="text-cyan-300 text-xs"
                  onClick={() =>
                    open({
                      title: `${a.label}豁免`,
                      baseBonus: saveBonus(d, a.id),
                    })
                  }
                >
                  {signed(saveBonus(d, a.id))}
                </Roll>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="技能"
          width={widthOf("skills")}
          editable={editable}
          onWidth={() => toggleWidth("skills")}
        >
          <div className="grid sm:grid-cols-2 gap-1">
            {SKILLS.map((s) => {
              const st = d.skills[s.id];
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm px-1">
                  <Roll
                    editable={editable}
                    className="w-14 text-left font-mono text-cyan-300"
                    onClick={() =>
                      open({
                        title: s.label,
                        baseBonus: skillBonus(d, s.id),
                        presetAdv: st?.adv === "none" ? "none" : st?.adv,
                      })
                    }
                  >
                    {signed(skillBonus(d, s.id))}
                  </Roll>
                  <span className="flex-1 truncate">{s.label}</span>
                  <label className="text-[10px] text-neutral-500">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={!!st?.proficient}
                      onChange={(e) =>
                        patch({
                          skills: {
                            ...d.skills,
                            [s.id]: { ...st, proficient: e.target.checked },
                          },
                        })
                      }
                    />{" "}
                    熟练
                  </label>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="生存"
          width={widthOf("survival")}
          editable={editable}
          onWidth={() => toggleWidth("survival")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Num label="当前 HP" value={d.hpCurrent} editable={editable} onChange={(hpCurrent) => patch({ hpCurrent })} />
            <Num label="最大 HP" value={d.hpMax} editable={editable} onChange={(hpMax) => patch({ hpMax })} />
            <Num label="临时 HP" value={d.hpTemp} editable={editable} onChange={(hpTemp) => patch({ hpTemp })} />
            <div className="text-xs text-neutral-400 flex items-center">AC {ac}</div>
            <Num label="护甲基数" value={d.armorBase} editable={editable} onChange={(armorBase) => patch({ armorBase })} />
            <Num label="盾" value={d.shield} editable={editable} onChange={(shield) => patch({ shield })} />
            <Num label="步行" value={d.speedWalk} editable={editable} onChange={(speedWalk) => patch({ speedWalk })} />
            <Num label="游泳" value={d.speedSwim} editable={editable} onChange={(speedSwim) => patch({ speedSwim })} />
            <Num label="飞行" value={d.speedFly} editable={editable} onChange={(speedFly) => patch({ speedFly })} />
            <Num label="攀爬" value={d.speedClimb} editable={editable} onChange={(speedClimb) => patch({ speedClimb })} />
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            <Roll
              editable={editable}
              className="text-xs text-cyan-300"
              onClick={() =>
                open({
                  title: "先攻",
                  baseBonus: abilityMod(d.abilities.dex),
                  breakdown: "d20 + 敏捷",
                })
              }
            >
              先攻 {signed(abilityMod(d.abilities.dex))}
            </Roll>
            <Roll
              editable={editable}
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
              死亡豁免
            </Roll>
          </div>
        </Panel>

        <Panel
          title="攻击"
          width={widthOf("attacks")}
          editable={editable}
          onWidth={() => toggleWidth("attacks")}
        >
          {d.weapons.map((w) => (
            <WeaponRow
              key={w.id}
              w={w}
              data={d}
              editable={editable}
              onChange={(nw) =>
                patch({ weapons: d.weapons.map((x) => (x.id === w.id ? nw : x)) })
              }
              onRemove={() =>
                patch({ weapons: d.weapons.filter((x) => x.id !== w.id) })
              }
            />
          ))}
          {editable && (
            <button
              type="button"
              className="text-xs text-cyan-300 mt-1"
              onClick={() =>
                patch({
                  weapons: [
                    ...d.weapons,
                    {
                      id: crypto.randomUUID(),
                      name: "新武器",
                      ability: "str",
                      proficient: true,
                      finesse: false,
                      ranged: false,
                      magic: 0,
                      dmgCount: 1,
                      dmgFaces: 8,
                      dmgBonus: 0,
                      dmgType: "挥砍",
                      range: "5",
                      notes: "",
                      weight: 0,
                    },
                  ],
                })
              }
            >
              + 武器
            </button>
          )}
        </Panel>

        <Panel
          title="装备"
          width={widthOf("gear")}
          editable={editable}
          onWidth={() => toggleWidth("gear")}
        >
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Num label="金 GP" value={d.gp} editable={editable} onChange={(gp) => patch({ gp })} />
            <Num label="银 SP" value={d.sp} editable={editable} onChange={(sp) => patch({ sp })} />
            <Num label="铜 CP" value={d.cp} editable={editable} onChange={(cp) => patch({ cp })} />
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
              editable={editable}
              onChange={(n) =>
                patch({ items: d.items.map((x) => (x.id === it.id ? n : x)) })
              }
              onRemove={() =>
                patch({ items: d.items.filter((x) => x.id !== it.id) })
              }
            />
          ))}
          {editable && (
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
        </Panel>

        <Panel
          title="法术"
          width={widthOf("spells")}
          editable={editable}
          onWidth={() => toggleWidth("spells")}
          extra={
            <label className="text-xs text-neutral-400">
              <input
                type="checkbox"
                disabled={!editable}
                checked={d.spellcastingOn}
                onChange={(e) => patch({ spellcastingOn: e.target.checked })}
              />{" "}
              启用
            </label>
          }
        >
          {d.spellcastingOn && (
            <SpellBlock
              d={d}
              editable={editable}
              patch={patch}
            />
          )}
        </Panel>

        <Panel
          title="语言 / 熟练"
          width={widthOf("profs")}
          editable={editable}
          onWidth={() => toggleWidth("profs")}
        >
          <ProfBlock
            title="种族"
            src={d.profs.race}
            fields={["languages", "skills", "weapons", "tools"]}
            editable={editable}
            onChange={(race) => patch({ profs: { ...d.profs, race } })}
          />
          <ProfBlock
            title="职业"
            src={d.profs.class}
            fields={["languages", "skills", "weapons", "armor", "tools"]}
            editable={editable}
            onChange={(cls) => patch({ profs: { ...d.profs, class: cls } })}
          />
          <ProfBlock
            title="背景"
            src={d.profs.background}
            fields={["languages", "skills", "tools"]}
            editable={editable}
            onChange={(background) => patch({ profs: { ...d.profs, background } })}
          />
        </Panel>

        <Panel
          title="特征 & 能力"
          width={widthOf("features")}
          editable={editable}
          onWidth={() => toggleWidth("features")}
        >
          <FeatureList
            heading="种族 / 专长 / 背景"
            items={d.featuresRace}
            editable={editable}
            onChange={(featuresRace) => patch({ featuresRace })}
          />
          <FeatureList
            heading="职业能力"
            items={d.featuresClass}
            editable={editable}
            onChange={(featuresClass) =>
              patch({ featuresClass, features: featuresClass })
            }
          />
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  width,
  editable,
  onWidth,
  extra,
  children,
}: {
  title: string;
  width: PanelWidth;
  editable: boolean;
  onWidth: () => void;
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
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white"
              onClick={onWidth}
            >
              {width === "full" ? "半宽" : "全宽"}
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Roll({
  editable,
  className,
  onClick,
  children,
}: {
  editable: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  if (editable) return <span className={className}>{children}</span>;
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
  editable,
  onChange,
  onRemove,
}: {
  w: DndWeapon;
  data: DndPlayData;
  editable: boolean;
  onChange: (w: DndWeapon) => void;
  onRemove: () => void;
}) {
  const open = useOpenCheck();
  const atk = weaponAttackBonus(data, w);
  const dmgB = weaponDamageBonus(data, w);

  if (editable) {
    return (
      <div className="border border-neutral-800 rounded p-2 space-y-2 text-sm">
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
            调整值
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
            伤害类型
            <input
              className={`${inp} w-full mt-0.5`}
              value={w.dmgType}
              onChange={(e) => onChange({ ...w, dmgType: e.target.value })}
              placeholder="穿刺"
            />
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
          <label className="text-[10px] text-neutral-500">
            备注
            <input
              className={`${inp} w-full mt-0.5`}
              value={w.notes}
              onChange={(e) => onChange({ ...w, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-neutral-400">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={w.proficient}
              onChange={(e) => onChange({ ...w, proficient: e.target.checked })}
            />
            熟练
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={w.finesse}
              onChange={(e) => onChange({ ...w, finesse: e.target.checked })}
            />
            灵巧
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={w.ranged}
              onChange={(e) => onChange({ ...w, ranged: e.target.checked })}
            />
            远程
          </label>
          <span className="text-neutral-500">
            命中 {signed(atk)} · 伤害 {w.dmgCount}d{w.dmgFaces}
            {signed(dmgB)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm border border-neutral-800 rounded p-2">
      <span className="flex-1 min-w-[80px]">{w.name}</span>
      <button
        type="button"
        className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 text-xs"
        onClick={() =>
          open({
            title: `${w.name} 命中`,
            baseBonus: atk,
            kind: "attack",
            dcLabel: "AC",
          })
        }
      >
        命中 {signed(atk)}
      </button>
      <button
        type="button"
        className="px-2 py-0.5 rounded bg-amber-950 text-amber-200 text-xs"
        onClick={() =>
          open({
            title: `${w.name} 伤害`,
            baseBonus: 0,
            kind: "damage",
            damageCount: w.dmgCount,
            damageFaces: w.dmgFaces,
            damageBonus: dmgB,
          })
        }
      >
        伤害 {w.dmgCount}d{w.dmgFaces}
        {signed(dmgB)} {w.dmgType}
      </button>
      <span className="text-[10px] text-neutral-500">{w.range}</span>
    </div>
  );
}

function SpellBlock({
  d,
  editable,
  patch,
}: {
  d: DndPlayData;
  editable: boolean;
  patch: (p: Partial<DndPlayData>) => void;
}) {
  const open = useOpenCheck();
  const slots = [...d.spellSlots];
  while (slots.length < 9) slots.push(0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm items-center">
        <span className="text-neutral-500 text-xs">职业Ⅰ 主属性</span>
        <select
          disabled={!editable}
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
          editable={editable}
          className="text-cyan-300 text-xs"
          onClick={() =>
            open({
              title: "职业Ⅰ 法术攻击",
              baseBonus: spellAttack(d, d.spellAbility),
              dcLabel: "AC",
            })
          }
        >
          职业Ⅰ DC {spellSaveDc(d, d.spellAbility)} / 攻击{" "}
          {signed(spellAttack(d, d.spellAbility))}
        </Roll>
        <span className="text-neutral-500 text-xs">职业Ⅱ</span>
        <select
          disabled={!editable}
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
            editable={editable}
            className="text-cyan-300 text-xs"
            onClick={() =>
              open({
                title: "职业Ⅱ 法术攻击",
                baseBonus: spellAttack(d, d.spellAbility2 as AbilityId),
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
        <div className="text-[10px] text-neutral-500 mb-1">每日法术位</div>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1">
          {SPELL_LEVEL_LABELS.slice(1).map((lab, i) => (
            <label key={lab} className="text-[10px] text-neutral-500">
              {lab}
              <input
                disabled={!editable}
                type="number"
                min={0}
                className={`${inp} w-full mt-0.5`}
                value={slots[i] || 0}
                onChange={(e) => {
                  const next = [...slots];
                  next[i] = Number(e.target.value) || 0;
                  patch({ spellSlots: next });
                }}
              />
            </label>
          ))}
        </div>
        <label className="text-[10px] text-neutral-500 inline-block mt-2">
          契约魔法环阶
          <input
            disabled={!editable}
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
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs text-neutral-300">{lab}</h4>
              {editable && (
                <button
                  type="button"
                  className="text-[10px] text-cyan-300"
                  onClick={() => patch({ spells: [...d.spells, emptySpell(lv)] })}
                >
                  + {lab}法术
                </button>
              )}
            </div>
            {list.map((sp) => (
              <SpellRow
                key={sp.id}
                sp={sp}
                editable={editable}
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
  editable,
  onChange,
  onRemove,
}: {
  sp: DndSpell;
  editable: boolean;
  onChange: (s: DndSpell) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const vsm = [sp.v && "V", sp.s && "S", sp.m && "M"].filter(Boolean).join("");
  if (editable) {
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
      <button
        type="button"
        className="w-full text-left flex flex-wrap items-center gap-x-2 gap-y-0.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={sp.prepared ? "text-cyan-300" : "text-neutral-500"}>
          {sp.prepared ? "●" : "○"}
        </span>
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
      {open && (
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
