"use client";

import { Character, PreferenceItem } from "@/lib/types";
import SectionHeader from "./SectionHeader";
import TraitSlider from "./TraitSlider";
import DotRating from "./DotRating";
import RadarChart from "./RadarChart";
import AvatarUpload from "./AvatarUpload";
import OptionSelect from "./OptionSelect";
import WorldSelect from "./WorldSelect";
import { OptionField } from "@/lib/worldCatalog";
import ResizableRow from "./ResizableRow";

interface Props {
  character: Character;
  onChange: (updates: Partial<Character>) => void;
  editable?: boolean;
  worlds?: string[];
  optionsFor?: (world: string, field: OptionField) => string[];
  onCreateWorld?: (world: string) => void;
  onAddOption?: (world: string, field: OptionField, value: string) => void;
}

export default function CharacterSheet({
  character: c,
  onChange,
  editable = true,
  worlds = [],
  optionsFor = () => [],
  onCreateWorld,
  onAddOption,
}: Props) {
  const update = <K extends keyof Character>(key: K, value: Character[K]) => {
    onChange({ [key]: value });
  };

  const updateNested = <
    T extends "traits" | "emotions" | "combat" | "happiness" | "outward"
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
      <ResizableRow storageKey="sheet-row-top">
        <div className="h-full">
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

        <div className="h-full">
          <SectionHeader title="基础信息 / Basic Info" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2 text-sm">
            <div className="flex gap-2 items-center pb-1 mb-1 border-b border-neutral-800">
              <span className="w-14 text-neutral-500 shrink-0">世界:</span>
              <WorldSelect
                value={c.world || ""}
                worlds={worlds}
                onChange={(w) => update("world", w)}
                onCreateWorld={onCreateWorld}
                editable={editable}
              />
            </div>

            <div className="flex gap-2 items-center">
              <span className="w-14 text-neutral-500 shrink-0">姓名:</span>
              {editable ? (
                <input
                  className="flex-1 bg-transparent border-b border-neutral-700 focus:border-purple-500 outline-none px-1 py-0.5 text-neutral-200"
                  value={c.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              ) : (
                <span className="text-neutral-200">{c.name}</span>
              )}
            </div>

            <OptionSelect
              label="性别"
              value={c.gender}
              options={optionsFor(c.world || "", "genders")}
              onChange={(v) => update("gender", v)}
              onCreateOption={(v) => onAddOption?.(c.world || "", "genders", v)}
              editable={editable}
            />
            <OptionSelect
              label="种族"
              value={c.race}
              options={optionsFor(c.world || "", "races")}
              onChange={(v) => update("race", v)}
              onCreateOption={(v) => onAddOption?.(c.world || "", "races", v)}
              editable={editable}
            />

            {(
              [
                ["年龄", "age", String(c.age)],
                ["身高", "height", c.height],
                ["体重", "weight", c.weight],
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

            <OptionSelect
              label="阵营"
              value={c.affiliation}
              options={optionsFor(c.world || "", "affiliations")}
              onChange={(v) => update("affiliation", v)}
              onCreateOption={(v) =>
                onAddOption?.(c.world || "", "affiliations", v)
              }
              editable={editable}
            />

            {(
              [
                ["身份", "identity", c.identity],
                ["天赋", "talent", c.talent],
                ["性格", "personality", c.personality],
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

            <OptionSelect
              label="出生地"
              value={c.birthplace}
              options={optionsFor(c.world || "", "birthplaces")}
              onChange={(v) => update("birthplace", v)}
              onCreateOption={(v) =>
                onAddOption?.(c.world || "", "birthplaces", v)
              }
              editable={editable}
            />
          </div>
        </div>

        <div className="h-full">
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
      </ResizableRow>

      {/* Middle row: Emotions + Combat + Happiness */}
      <ResizableRow storageKey="sheet-row-mid">
        <div className="h-full">
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

        <div className="h-full">
          <SectionHeader title="战斗风格 / Combat Style" />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-2 flex justify-center">
            <RadarChart
              data={c.combat}
              size={220}
              onChange={
                editable
                  ? (key, value) => updateNested("combat", key, value)
                  : undefined
              }
            />
          </div>
          {editable && (
            <div className="bg-[#111] border border-neutral-800 border-t-0 p-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {(
                [
                  ["经验", "experience"],
                  ["协作", "collaboration"],
                  ["冲突", "conflict"],
                  ["智取", "intelligence"],
                  ["应变", "adaptability"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-8 text-neutral-400 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={c.combat[key]}
                    onChange={(e) =>
                      updateNested("combat", key, Number(e.target.value))
                    }
                    className="combat-slider flex-1"
                  />
                  <span className="w-7 text-right tabular-nums text-purple-300 font-medium">
                    {c.combat[key]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-full">
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
      </ResizableRow>

      {/* Bottom row: Preferences + Outward + Story */}
      <ResizableRow storageKey="sheet-row-bot">
        <div className="h-full">
          <SectionHeader
            title="个人喜好 / Preferences"
            onAdd={
              editable
                ? () => {
                    const item: PreferenceItem = {
                      id: crypto.randomUUID(),
                      title: "新喜好",
                      content: "",
                    };
                    onChange({ preferences: [...c.preferences, item] });
                  }
                : undefined
            }
          />
          <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-3 text-xs">
            {c.preferences.length === 0 && (
              <p className="text-neutral-500 text-center py-4">
                点击 + 添加自定义喜好条目
              </p>
            )}
            {c.preferences.map((pref, idx) => (
              <div key={pref.id} className="relative group">
                {editable ? (
                  <>
                    <input
                      className="w-full bg-transparent text-purple-400 mb-1 font-medium outline-none border-b border-transparent focus:border-purple-600"
                      value={pref.title}
                      placeholder="标题"
                      onChange={(e) => {
                        const next = [...c.preferences];
                        next[idx] = { ...pref, title: e.target.value };
                        onChange({ preferences: next });
                      }}
                    />
                    <textarea
                      className="w-full bg-[#0a0a0a] border border-neutral-700 rounded p-2 text-neutral-300 min-h-[60px] outline-none focus:border-purple-500"
                      value={pref.content}
                      placeholder="内容..."
                      onChange={(e) => {
                        const next = [...c.preferences];
                        next[idx] = { ...pref, content: e.target.value };
                        onChange({ preferences: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          preferences: c.preferences.filter((p) => p.id !== pref.id),
                        });
                      }}
                      className="absolute top-0 right-0 text-neutral-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs px-1"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-purple-400 mb-1 font-medium">{pref.title}</div>
                    <p className="text-neutral-400 leading-relaxed">{pref.content || "—"}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-full">
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
                <DotRating
                  value={c.outward[key]}
                  onChange={
                    editable
                      ? (v) => updateNested("outward", key, v)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="h-full">
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
      </ResizableRow>
    </div>
  );
}
