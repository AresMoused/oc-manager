"use client";

import Link from "next/link";
import type { Character } from "@/lib/types";
import { useOpenCheck } from "@/systems/check/CheckHost";
import {
  ABILITIES,
  SKILLS,
  abilityMod,
  armorClass,
  parseDndPlay,
  passiveSkill,
  proficiencyBonus,
  saveBonus,
  signed,
  skillBonus,
  spellAttack,
  spellSaveDc,
  totalLevel,
  type AbilityId,
  type AdvPreset,
} from "./schema";

const SKILL_COLOR: Record<string, string> = {
  str: "bg-red-950/80",
  dex: "bg-sky-950/80",
  con: "bg-orange-950/60",
  int: "bg-emerald-950/80",
  wis: "bg-amber-950/80",
  cha: "bg-fuchsia-950/80",
};

export default function DndBriefCard({
  character,
  href,
}: {
  character: Character;
  href: string;
}) {
  const open = useOpenCheck();
  const d = parseDndPlay(character.play?.data);
  const lv = totalLevel(d);
  const pb = proficiencyBonus(lv);
  const ac = armorClass(d);

  const rollAbility = (id: AbilityId) =>
    open({
      title: `${ABILITIES.find((a) => a.id === id)?.label}检定`,
      baseBonus: abilityMod(d.abilities[id]),
      breakdown: `调整值 ${signed(abilityMod(d.abilities[id]))}`,
    });

  const rollSave = (id: AbilityId) =>
    open({
      title: `${ABILITIES.find((a) => a.id === id)?.label}豁免`,
      baseBonus: saveBonus(d, id),
      breakdown: d.saveProf[id] ? "含熟练" : "未熟练",
    });

  const rollSkill = (id: string, label: string, adv: AdvPreset) =>
    open({
      title: label,
      baseBonus: skillBonus(d, id),
      presetAdv: adv === "none" ? "none" : adv,
    });

  return (
    <div className="min-w-[320px] max-w-[420px] flex-1 rounded-xl border border-neutral-800 bg-[#14110e] text-neutral-100 p-3 text-[11px] leading-tight">
      <div className="flex items-center justify-between mb-2">
        <Link href={href} className="font-serif text-sm text-sky-300 hover:underline truncate">
          {character.name || "未命名"}
        </Link>
        <span className="text-neutral-500">
          {character.sheetRole === "npc" ? "NPC" : character.playerName || "玩家"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 mb-2 text-center">
        <Meta label="种族" value={character.race} />
        <Meta label="阵营" value={character.affiliation} />
        <Meta label="体型" value="中型" />
        <div className="grid grid-cols-4 gap-px bg-neutral-800 rounded overflow-hidden col-span-4 sm:col-span-1 sm:grid-cols-4">
          {[
            ["步行", d.speedWalk],
            ["游泳", d.speedSwim],
            ["飞行", d.speedFly],
            ["攀爬", d.speedClimb],
          ].map(([k, v]) => (
            <div key={String(k)} className="bg-[#1b1b1b] px-0.5 py-0.5">
              <div className="text-[9px] text-neutral-500">{k}</div>
              <div>{v as number}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="shrink-0">
          {ABILITIES.map((a) => (
            <div key={a.id} className="flex items-center gap-1 mb-0.5">
              <span className="w-8 text-neutral-400">{a.label}</span>
              <span className="w-6 text-right font-bold">{d.abilities[a.id]}</span>
              <button
                type="button"
                onClick={() => rollAbility(a.id)}
                className="w-6 text-rose-400 font-bold hover:text-white"
              >
                {abilityMod(d.abilities[a.id])}
              </button>
              <span className="w-3 text-center">{d.saveProf[a.id] ? "✓" : ""}</span>
              <button
                type="button"
                onClick={() => rollSave(a.id)}
                className="w-6 text-rose-300 hover:text-white"
              >
                {signed(saveBonus(d, a.id))}
              </button>
            </div>
          ))}
          <div className="mt-2 space-y-0.5 text-[10px] text-neutral-400">
            <p>被动洞悉 {passiveSkill(d, "insight")}</p>
            <p>被动察觉 {passiveSkill(d, "perception")}</p>
            <p>被动调查 {passiveSkill(d, "investigation")}</p>
            <p>熟练 {signed(pb)}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex gap-1">
            <StatBox label="血量" value={`${d.hpCurrent}/${d.hpMax}`} color="bg-emerald-900/50" />
            <StatBox label="防御" value={ac} color="bg-sky-900/50" />
            <button
              type="button"
              onClick={() =>
                open({
                  title: "法术攻击",
                  baseBonus: spellAttack(d, d.spellAbility),
                  dcLabel: "AC",
                })
              }
              className="flex-1 rounded bg-lime-950/50 px-1 py-1"
            >
              <div className="text-[9px] text-neutral-500">法术 DC / 攻击</div>
              <div>
                {spellSaveDc(d, d.spellAbility)} / {signed(spellAttack(d, d.spellAbility))}
              </div>
            </button>
            <StatBox label="等级" value={lv} color="bg-yellow-900/40" />
          </div>
          <div className="grid grid-cols-2 gap-px">
            {SKILLS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => rollSkill(s.id, s.label, d.skills[s.id]?.adv || "none")}
                className={`flex items-center justify-between px-1.5 py-0.5 rounded ${SKILL_COLOR[s.ability]}`}
              >
                <span className="truncate">{s.label}</span>
                <span className="font-mono">{signed(skillBonus(d, s.id))}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-center">
            <Coin c="金" n={d.gp} bg="bg-yellow-700" />
            <Coin c="银" n={d.sp} bg="bg-neutral-500" />
            <Coin c="铜" n={d.cp} bg="bg-amber-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-neutral-500">{label}</div>
      <div className="truncate">{value || "—"}</div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`flex-1 rounded px-1 py-1 ${color}`}>
      <div className="text-[9px] text-neutral-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Coin({ c, n, bg }: { c: string; n: number; bg: string }) {
  return (
    <div className={`flex-1 rounded ${bg} text-black font-semibold py-0.5`}>{c} {n}</div>
  );
}
