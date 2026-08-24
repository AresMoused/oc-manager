"use client";

import { useState } from "react";
import {
  ABILITIES,
  DAMAGE_MAGICAL,
  DAMAGE_PHYSICAL,
  SPELL_LEVEL_LABELS,
  SPELL_SCHOOLS,
  emptySpell,
  type AbilityId,
  type DndSpellPreset,
} from "./schema";

const inp =
  "bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200";

export default function SpellPresetPanel({
  presets,
  onChange,
  defaultCollapsed = false,
}: {
  presets: DndSpellPreset[];
  onChange: (next: DndSpellPreset[]) => void;
  defaultCollapsed?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const query = q.trim().toLowerCase();

  const add = (level = 0) => {
    const s = { ...emptySpell(level), name: "新法术", prepared: false };
    onChange([...presets, s]);
    setOpenId(s.id);
  };

  const update = (id: string, n: DndSpellPreset) =>
    onChange(presets.map((p) => (p.id === id ? n : p)));

  return (
    <section className="rounded-xl border border-neutral-800 bg-[#111] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-white">法术预设</h2>
          <p className="text-[11px] text-neutral-500">
            已载入 2024 核心 {presets.length} 个。角色卡可「从预设拉取」。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-neutral-300 border border-neutral-700 rounded px-2 py-1"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "展开列表" : "收起列表"}
          </button>
          <button
            type="button"
            className="text-xs text-cyan-300"
            onClick={() => add(0)}
          >
            + 法术
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
      <input
        className={`${inp} w-full text-xs`}
        placeholder="搜索法术名、学派、伤害…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {SPELL_LEVEL_LABELS.map((lab, lv) => {
        const list = presets.filter((p) => {
          if (p.level !== lv) return false;
          if (!query) return true;
          const blob = `${p.name} ${p.school} ${p.effect} ${p.dmgType}`.toLowerCase();
          return blob.includes(query);
        });
        if (!list.length) return null;
        return (
          <div key={lv}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] text-neutral-400">{lab}</h3>
              <button
                type="button"
                className="text-[10px] text-cyan-300"
                onClick={() => add(lv)}
              >
                + {lab}
              </button>
            </div>
            {list.map((sp) => (
              <div
                key={sp.id}
                className="border border-neutral-800 rounded mb-1 p-2 text-sm"
              >
                <button
                  type="button"
                  className="w-full text-left flex items-center gap-2"
                  onClick={() => setOpenId(openId === sp.id ? null : sp.id)}
                >
                  <span className="flex-1">{sp.name || "未命名"}</span>
                  {sp.hasAttack && (
                    <span className="text-[10px] text-cyan-400">攻击</span>
                  )}
                  {sp.saveAbility && (
                    <span className="text-[10px] text-rose-400">豁免</span>
                  )}
                  {sp.dmgCount > 0 && (
                    <span className="text-[10px] text-amber-400">
                      {sp.dmgCount}d{sp.dmgFaces} {sp.dmgType}
                    </span>
                  )}
                  {sp.url && (
                    <a
                      href={sp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-sky-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      介绍
                    </a>
                  )}
                </button>
                {openId === sp.id && (
                  <PresetEditor
                    sp={sp}
                    onChange={(n) => update(sp.id, n)}
                    onRemove={() =>
                      onChange(presets.filter((x) => x.id !== sp.id))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        );
      })}
        </>
      )}
    </section>
  );
}

function PresetEditor({
  sp,
  onChange,
  onRemove,
}: {
  sp: DndSpellPreset;
  onChange: (s: DndSpellPreset) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        <input
          className={`${inp} flex-1`}
          value={sp.name}
          onChange={(e) => onChange({ ...sp, name: e.target.value })}
        />
        <select
          className={inp}
          value={sp.level}
          onChange={(e) => onChange({ ...sp, level: Number(e.target.value) })}
        >
          {SPELL_LEVEL_LABELS.map((lab, i) => (
            <option key={lab} value={i}>
              {lab}
            </option>
          ))}
        </select>
        <button type="button" className="text-rose-400 text-xs" onClick={onRemove}>
          删除
        </button>
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
            checked={sp.hasAttack}
            onChange={(e) => onChange({ ...sp, hasAttack: e.target.checked })}
          />
          法术攻击
        </label>
        <label className="flex items-center gap-1">
          豁免
          <select
            className={inp}
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
        <label className="flex items-center gap-1">
          伤害
          <input
            type="number"
            min={0}
            className={`${inp} w-10`}
            value={sp.dmgCount}
            onChange={(e) => onChange({ ...sp, dmgCount: Number(e.target.value) || 0 })}
          />
          d
          <input
            type="number"
            min={2}
            className={`${inp} w-10`}
            value={sp.dmgFaces}
            onChange={(e) => onChange({ ...sp, dmgFaces: Number(e.target.value) || 6 })}
          />
        </label>
        <label className="flex items-center gap-1">
          类型
          <select
            className={inp}
            value={sp.dmgType}
            onChange={(e) => onChange({ ...sp, dmgType: e.target.value })}
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
          </select>
        </label>
      </div>
      <textarea
        className={`${inp} w-full min-h-[120px]`}
        placeholder="效果"
        value={sp.effect}
        onChange={(e) => onChange({ ...sp, effect: e.target.value })}
      />
      <label className="text-[10px] text-neutral-500 block">
        介绍链接
        <input
          className={`${inp} w-full mt-0.5`}
          value={sp.url || ""}
          placeholder="https://…"
          onChange={(e) => onChange({ ...sp, url: e.target.value })}
        />
      </label>
      {sp.url && (
        <a
          href={sp.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-sky-400 hover:underline"
        >
          打开法术介绍 ↗
        </a>
      )}
    </div>
  );
}
