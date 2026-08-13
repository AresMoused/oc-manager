"use client";

import { Character } from "@/lib/types";
import SectionHeader from "./SectionHeader";
import TraitSlider from "./TraitSlider";
import DotRating from "./DotRating";
import RadarChart from "./RadarChart";
import AvatarUpload from "./AvatarUpload";

interface Props {
  character: Character;
  onChange: (updates: Partial<Character>) => void;
  editable?: boolean;
}

export default function CharacterSheet({
  character: c,
  onChange,
  editable = true,
}: Props) {
  const update = <K extends keyof Character>(key: K, value: Character[K]) => {
    onChange({ [key]: value });
  };

  const updateNested = <
    T extends "traits" | "emotions" | "combat" | "happiness" | "preferences" | "outward"
  >(
    section: T,
    key: keyof Character[T],
    value: number | string
  ) => {
    onChange({
      [section]: {
        ...c[section],
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Top row: Avatar + Basic + Traits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Avatar */}
        <div className="lg:col-span-3">
          <SectionHeader title="头像 / Avatar" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 flex justify-center">
            <AvatarUpload
              src={c.avatar}
              name={c.name}
              onChange={editable ? (b64) => update("avatar", b64) : undefined}
              size={180}
            />
          </div>
        </div>

        {/* Basic Info */}
        <div className="lg:col-span-4">
          <SectionHeader title="基础信息 / Basic Info" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-1.5 text-sm">
            {(
              [
                ["姓名", "name", c.name],
                ["性别", "gender", c.gender],
                ["年龄", "age", String(c.age)],
                ["种族", "race", c.race],
                ["身高", "height", c.height],
                ["体重", "weight", c.weight],
                ["阵营", "affiliation", c.affiliation],
                ["身份", "identity", c.identity],
                ["天赋", "talent", c.talent],
                ["性格", "personality", c.personality],
                ["出生地", "birthplace", c.birthplace],
              ] as const
            ).map(([label, key, val]) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="w-14 text-neutral-500 shrink-0">{label}:</span>
                {editable ? (
                  <input
                    className="flex-1 bg-transparent border-b border-neutral-700 focus:border-purple-500 outline-none px-1 py-0.5 text-neutral-200"
                    value={val}
                    onChange={(e) =>
                      update(key as keyof Character, e.target.value as never)
                    }
                  />
                ) : (
                  <span className="text-neutral-200">{val}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trait Analysis */}
        <div className="lg:col-span-5">
          <SectionHeader title="特质分析 / Trait Analysis" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2.5">
            <TraitSlider leftLabel="乐观" rightLabel="悲观" value={c.traits.optimistic} onChange={editable ? (v) => updateNested("traits", "optimistic", v) : undefined} />
            <TraitSlider leftLabel="开放" rightLabel="保守" value={c.traits.open} onChange={editable ? (v) => updateNested("traits", "open", v) : undefined} />
            <TraitSlider leftLabel="感性" rightLabel="理性" value={c.traits.emotional} onChange={editable ? (v) => updateNested("traits", "emotional", v) : undefined} />
            <TraitSlider leftLabel="果断" rightLabel="犹豫" value={c.traits.decisive} onChange={editable ? (v) => updateNested("traits", "decisive", v) : undefined} />
            <TraitSlider leftLabel="健谈" rightLabel="寡言" value={c.traits.talkative} onChange={editable ? (v) => updateNested("traits", "talkative", v) : undefined} />
            <TraitSlider leftLabel="冒险" rightLabel="谨慎" value={c.traits.adventurous} onChange={editable ? (v) => updateNested("traits", "adventurous", v) : undefined} />
            <TraitSlider leftLabel="随和" rightLabel="挑剔" value={c.traits.gentle} onChange={editable ? (v) => updateNested("traits", "gentle", v) : undefined} />
          </div>
        </div>
      </div>

      {/* Middle row: Emotions + Combat + Happiness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-4">
          <SectionHeader title="情绪评估 / Emotional Assessment" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2 text-xs">
            {(
              [
                ["外向", "内向", "extrovert"],
                ["积极", "消极", "positive"],
                ["勇敢", "胆小", "brave"],
                ["热情", "冷漠", "passionate"],
                ["勤奋", "懒惰", "diligent"],
                ["慷慨", "吝啬", "generous"],
                ["诚实", "虚伪", "honest"],
                ["宽容", "苛刻", "tolerant"],
                ["坚强", "脆弱", "strong"],
                ["开朗", "忧郁", "cheerful"],
              ] as const
            ).map(([left, right, key]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 text-right text-neutral-400">{left}</span>
                <DotRating value={c.emotions[key]} onChange={editable ? (v) => updateNested("emotions", key, v) : undefined} />
                <span className="w-8 text-neutral-400">{right}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <SectionHeader title="战斗风格 / Combat Style" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-2 flex justify-center">
            <RadarChart data={c.combat} size={220} />
          </div>
          {editable && (
            <div className="bg-[#111] border border-neutral-800 border-t-0 p-2 grid grid-cols-2 gap-1 text-xs">
              {(
                [
                  ["经验", "experience"],
                  ["协作", "collaboration"],
                  ["冲突", "conflict"],
                  ["智取", "intelligence"],
                  ["应变", "adaptability"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="w-8 text-neutral-500">{label}</span>
                  <input type="range" min={0} max={100} value={c.combat[key]} onChange={(e) => updateNested("combat", key, Number(e.target.value))} className="flex-1" />
                  <span className="w-6 text-right tabular-nums">{c.combat[key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4">
          <SectionHeader title="幸福指数 / Happiness Index" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2 text-xs">
            {(
              [
                ["家庭", "family"],
                ["情感", "emotion"],
                ["健康", "health"],
                ["经济", "economy"],
                ["人际", "interpersonal"],
                ["地位", "status"],
                ["成长", "growth"],
                ["心理", "psychology"],
                ["自主", "autonomy"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-8 text-neutral-400">{label}</span>
                <DotRating value={c.happiness[key]} onChange={editable ? (v) => updateNested("happiness", key, v) : undefined} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Preferences + Outward + Story */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-4">
          <SectionHeader title="个人喜好 / Preferences" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-3 text-xs">
            <div>
              <div className="text-purple-400 mb-1 font-medium">聆听风语 · Listening to the Wind</div>
              {editable ? (
                <textarea className="w-full bg-[#0a0a0a] border border-neutral-700 rounded p-2 text-neutral-300 min-h-[60px] outline-none focus:border-purple-500" value={c.preferences.listeningWind} onChange={(e) => updateNested("preferences", "listeningWind", e.target.value)} />
              ) : (
                <p className="text-neutral-400 leading-relaxed">{c.preferences.listeningWind || "—"}</p>
              )}
            </div>
            <div>
              <div className="text-purple-400 mb-1 font-medium">仰望星空 · Gazing at the Stars</div>
              {editable ? (
                <textarea className="w-full bg-[#0a0a0a] border border-neutral-700 rounded p-2 text-neutral-300 min-h-[60px] outline-none focus:border-purple-500" value={c.preferences.gazingStars} onChange={(e) => updateNested("preferences", "gazingStars", e.target.value)} />
              ) : (
                <p className="text-neutral-400 leading-relaxed">{c.preferences.gazingStars || "—"}</p>
              )}
            </div>
            <div>
              <div className="text-purple-400 mb-1 font-medium">记录见闻 · Recording Sights</div>
              {editable ? (
                <textarea className="w-full bg-[#0a0a0a] border border-neutral-700 rounded p-2 text-neutral-300 min-h-[60px] outline-none focus:border-purple-500" value={c.preferences.recordingSights} onChange={(e) => updateNested("preferences", "recordingSights", e.target.value)} />
              ) : (
                <p className="text-neutral-400 leading-relaxed">{c.preferences.recordingSights || "—"}</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <SectionHeader title="对外表现 / Outward" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2.5 text-xs">
            {(
              [
                ["平凡", "ordinary"],
                ["乐天", "optimistic"],
                ["平静", "calm"],
                ["高效", "efficient"],
                ["友善", "friendly"],
                ["稳重", "steady"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 text-neutral-400">{label}</span>
                <DotRating value={c.outward[key]} onChange={editable ? (v) => updateNested("outward", key, v) : undefined} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <SectionHeader title="故事经历 / Story Experience" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3">
            {editable ? (
              <textarea
                className="w-full bg-[#0a0a0a] border border-neutral-700 rounded p-3 text-sm text-neutral-300 min-h-[220px] outline-none focus:border-purple-500 leading-relaxed"
                value={c.story}
                onChange={(e) => update("story", e.target.value)}
                placeholder="Write the character's backstory here..."
              />
            ) : (
              <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap min-h-[220px]">
                {c.story || "No story yet."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
