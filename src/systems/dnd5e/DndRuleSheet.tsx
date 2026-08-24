"use client";

import type { Character } from "@/lib/types";
import { FreeDiceButton, useOpenCheck } from "@/systems/check/CheckHost";
import {
  ABILITIES,
  SKILLS,
  abilityMod,
  armorClass,
  carryingCap,
  currentWeight,
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
  type DndPlayData,
  type DndWeapon,
} from "./schema";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FreeDiceButton />
        <label className="text-xs text-neutral-400 flex items-center gap-2">
          身份
          <select
            disabled={!editable}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
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
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
            placeholder="玩家名"
            value={character.playerName || ""}
            onChange={(e) => onMeta?.({ playerName: e.target.value })}
          />
        )}
      </div>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <h3 className="text-sm text-white font-medium">摘要</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {d.classes.map((cl, i) => (
            <div key={i} className="flex gap-1">
              <input
                disabled={!editable}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                placeholder={`职业 ${i + 1}`}
                value={cl.name}
                onChange={(e) => {
                  const classes = d.classes.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x
                  );
                  patch({ classes });
                }}
              />
              <input
                disabled={!editable}
                type="number"
                className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1 py-1"
                value={cl.level}
                onChange={(e) => {
                  const classes = d.classes.map((x, j) =>
                    j === i ? { ...x, level: Number(e.target.value) || 1 } : x
                  );
                  patch({ classes });
                }}
              />
            </div>
          ))}
          {editable && d.classes.length < 5 && (
            <button
              type="button"
              className="text-xs text-cyan-300"
              onClick={() =>
                patch({ classes: [...d.classes, { name: "", level: 1 }] })
              }
            >
              + 兼職
            </button>
          )}
          <Num label="经验" value={d.xp} editable={editable} onChange={(xp) => patch({ xp })} />
          <div className="text-neutral-400 text-xs flex items-center">熟练 {signed(pb)}</div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3">
        <h3 className="text-sm text-white font-medium mb-2">属性 / 豁免</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ABILITIES.map((a) => (
            <div key={a.id} className="flex items-center gap-2 bg-neutral-950 rounded px-2 py-1.5">
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
              <button
                type="button"
                className="text-rose-400 font-bold w-8"
                onClick={() =>
                  open({
                    title: `${a.label}检定`,
                    baseBonus: abilityMod(d.abilities[a.id]),
                  })
                }
              >
                {signed(abilityMod(d.abilities[a.id]))}
              </button>
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
              <button
                type="button"
                className="text-cyan-300 text-xs"
                onClick={() =>
                  open({
                    title: `${a.label}豁免`,
                    baseBonus: saveBonus(d, a.id),
                  })
                }
              >
                {signed(saveBonus(d, a.id))}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3">
        <h3 className="text-sm text-white font-medium mb-2">技能</h3>
        <div className="grid sm:grid-cols-2 gap-1">
          {SKILLS.map((s) => {
            const st = d.skills[s.id];
            return (
              <div key={s.id} className="flex items-center gap-2 text-sm px-1">
                <button
                  type="button"
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
                </button>
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
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <h3 className="text-sm text-white font-medium">生存</h3>
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
        <button
          type="button"
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
        </button>
        <button
          type="button"
          className="ml-3 text-xs text-rose-300"
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
        </button>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <h3 className="text-sm text-white font-medium">攻击</h3>
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
            className="text-xs text-cyan-300"
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
                  },
                ],
              })
            }
          >
            + 武器
          </button>
        )}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <h3 className="text-sm text-white font-medium">装备</h3>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Num label="金" value={d.gp} editable={editable} onChange={(gp) => patch({ gp })} />
          <Num label="银" value={d.sp} editable={editable} onChange={(sp) => patch({ sp })} />
          <Num label="铜" value={d.cp} editable={editable} onChange={(cp) => patch({ cp })} />
        </div>
        <p className="text-xs text-neutral-500">
          负重 {currentWeight(d).toFixed(1)} / {carryingCap(d)} 磅
        </p>
        {d.items.map((it) => (
          <div key={it.id} className="flex gap-2 text-sm">
            <input
              disabled={!editable}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
              value={it.name}
              onChange={(e) =>
                patch({
                  items: d.items.map((x) =>
                    x.id === it.id ? { ...x, name: e.target.value } : x
                  ),
                })
              }
            />
            <input
              disabled={!editable}
              type="number"
              className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1"
              value={it.qty}
              onChange={(e) =>
                patch({
                  items: d.items.map((x) =>
                    x.id === it.id ? { ...x, qty: Number(e.target.value) || 0 } : x
                  ),
                })
              }
            />
            <input
              disabled={!editable}
              type="number"
              className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1"
              value={it.weight}
              onChange={(e) =>
                patch({
                  items: d.items.map((x) =>
                    x.id === it.id
                      ? { ...x, weight: Number(e.target.value) || 0 }
                      : x
                  ),
                })
              }
            />
          </div>
        ))}
        {editable && (
          <button
            type="button"
            className="text-xs text-cyan-300"
            onClick={() =>
              patch({
                items: [
                  ...d.items,
                  {
                    id: crypto.randomUUID(),
                    name: "物品",
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
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm text-white font-medium">法术</h3>
          <label className="text-xs text-neutral-400">
            <input
              type="checkbox"
              disabled={!editable}
              checked={d.spellcastingOn}
              onChange={(e) => patch({ spellcastingOn: e.target.checked })}
            />{" "}
            启用
          </label>
        </div>
        {d.spellcastingOn && (
          <>
            <div className="flex flex-wrap gap-2 text-sm items-center">
              <span className="text-neutral-500 text-xs">主属性</span>
              <select
                disabled={!editable}
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                value={d.spellAbility}
                onChange={(e) => patch({ spellAbility: e.target.value as AbilityId })}
              >
                {ABILITIES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-cyan-300 text-xs"
                onClick={() =>
                  open({
                    title: "法术攻击",
                    baseBonus: spellAttack(d, d.spellAbility),
                    dcLabel: "AC",
                  })
                }
              >
                DC {spellSaveDc(d, d.spellAbility)} / 攻击{" "}
                {signed(spellAttack(d, d.spellAbility))}
              </button>
            </div>
            {d.spells.map((sp) => (
              <div key={sp.id} className="flex gap-2 text-sm">
                <input
                  disabled={!editable}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                  value={sp.name}
                  onChange={(e) =>
                    patch({
                      spells: d.spells.map((x) =>
                        x.id === sp.id ? { ...x, name: e.target.value } : x
                      ),
                    })
                  }
                />
                <input
                  disabled={!editable}
                  type="number"
                  className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1"
                  value={sp.level}
                  onChange={(e) =>
                    patch({
                      spells: d.spells.map((x) =>
                        x.id === sp.id ? { ...x, level: Number(e.target.value) || 0 } : x
                      ),
                    })
                  }
                />
              </div>
            ))}
            {editable && (
              <button
                type="button"
                className="text-xs text-cyan-300"
                onClick={() =>
                  patch({
                    spells: [
                      ...d.spells,
                      {
                        id: crypto.randomUUID(),
                        name: "法术",
                        level: 0,
                        prepared: true,
                        notes: "",
                      },
                    ],
                  })
                }
              >
                + 法术书条目
              </button>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-[#111] p-3 space-y-2">
        <h3 className="text-sm text-white font-medium">语言与熟练 / 特征</h3>
        <textarea
          disabled={!editable}
          className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm min-h-[60px]"
          placeholder="语言、武器、护甲、工具"
          value={d.languages + (d.proficiencies ? `\n${d.proficiencies}` : "")}
          onChange={(e) => patch({ languages: e.target.value, proficiencies: "" })}
        />
        {d.features.map((f) => (
          <input
            key={f.id}
            disabled={!editable}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
            value={f.name}
            onChange={(e) =>
              patch({
                features: d.features.map((x) =>
                  x.id === f.id ? { ...x, name: e.target.value } : x
                ),
              })
            }
          />
        ))}
        {editable && (
          <button
            type="button"
            className="text-xs text-cyan-300"
            onClick={() =>
              patch({
                features: [
                  ...d.features,
                  { id: crypto.randomUUID(), name: "特征", uses: "", body: "" },
                ],
              })
            }
          >
            + 特征
          </button>
        )}
      </section>
    </div>
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
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
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
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm border border-neutral-800 rounded p-2">
      <input
        disabled={!editable}
        className="flex-1 min-w-[80px] bg-transparent border-b border-neutral-700"
        value={w.name}
        onChange={(e) => onChange({ ...w, name: e.target.value })}
      />
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
        {signed(dmgB)}
      </button>
      {editable && (
        <button type="button" className="text-neutral-500 text-xs" onClick={onRemove}>
          删除
        </button>
      )}
    </div>
  );
}
