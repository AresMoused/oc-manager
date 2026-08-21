"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  Character,
  PreferenceItem,
  BipolarSliderItem,
  SheetModule,
  SheetModuleType,
  RadarAxis,
  normalizeModules,
  legacyFieldsFromModules,
  createSheetModule,
} from "@/lib/types";
import SectionHeader from "./SectionHeader";
import RadarChart from "./RadarChart";
import AvatarUpload from "./AvatarUpload";
import OptionSelect from "./OptionSelect";
import WorldSelect from "./WorldSelect";
import { OptionField } from "@/lib/worldCatalog";
import { TraitsList, addBtn } from "./DynamicMetrics";

interface Props {
  character: Character;
  onChange: (updates: Partial<Character>) => void;
  editable?: boolean;
  worlds?: string[];
  optionsFor?: (world: string, field: OptionField) => string[];
  onCreateWorld?: (world: string) => void;
  onAddOption?: (world: string, field: OptionField, value: string) => void;
}

const SCALE_KEY = "oc-sheet-scale";
const HEIGHT_KEY = "oc-sheet-panel-height";

function Panel({
  title,
  children,
  height,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  height: number;
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col min-h-0 rounded-md overflow-hidden"
      style={{ height }}
    >
      <SectionHeader title={title}>{actions}</SectionHeader>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#111] border border-neutral-800 border-t-0 rounded-b-md">
        {children}
      </div>
    </div>
  );
}

function chromeBtn(
  label: string,
  onClick: () => void,
  title?: string,
  danger?: boolean
) {
  return (
    <button
      type="button"
      title={title || label}
      onClick={onClick}
      className={`h-5 min-w-[20px] px-1.5 rounded text-[10px] leading-none ${
        danger
          ? "bg-rose-500/20 hover:bg-rose-500/40 text-rose-200"
          : "bg-white/15 hover:bg-white/30 text-white"
      }`}
    >
      {label}
    </button>
  );
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
  const [scale, setScale] = useState(100);
  const [panelHeight, setPanelHeight] = useState(340);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SCALE_KEY);
      const h = localStorage.getItem(HEIGHT_KEY);
      if (s) setScale(Math.min(150, Math.max(70, Number(s) || 100)));
      if (h) setPanelHeight(Math.min(560, Math.max(220, Number(h) || 340)));
    } catch {
      /* ignore */
    }
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem(SCALE_KEY, String(scale));
      localStorage.setItem(HEIGHT_KEY, String(panelHeight));
    } catch {
      /* ignore */
    }
  }, [scale, panelHeight, prefsReady]);

  const update = <K extends keyof Character>(key: K, value: Character[K]) => {
    onChange({ [key]: value });
  };

  const modules: SheetModule[] = Array.isArray(c.modules)
    ? c.modules
    : normalizeModules(undefined, {
        traits: c.traits,
        combat: c.combat,
        preferences: c.preferences,
      });

  const commitModules = (next: SheetModule[]) => {
    onChange({
      modules: next,
      ...legacyFieldsFromModules(next, {
        traits: c.traits,
        combat: c.combat,
        preferences: c.preferences,
      }),
    });
  };

  const replaceModule = (id: string, next: SheetModule) => {
    commitModules(modules.map((m) => (m.id === id ? next : m)));
  };

  const moveModule = (id: string, dir: -1 | 1) => {
    const i = modules.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= modules.length) return;
    const next = [...modules];
    [next[i], next[j]] = [next[j], next[i]];
    commitModules(next);
  };

  const h = panelHeight;
  const avatarSize = Math.max(
    100,
    Math.min(Math.floor(panelHeight * 0.72), panelHeight - 72)
  );

  const moduleTitle = (m: SheetModule): ReactNode =>
    editable ? (
      <input
        className="bg-transparent text-sm font-semibold text-white outline-none min-w-[4rem] max-w-[12rem]"
        value={m.title}
        onChange={(e) => replaceModule(m.id, { ...m, title: e.target.value } as SheetModule)}
      />
    ) : (
      m.title
    );

  const moduleActions = (m: SheetModule): ReactNode => {
    if (!editable) return undefined;
    let add: ReactNode = null;
    if (m.type === "sliders") {
      add = addBtn(() =>
        replaceModule(m.id, {
          ...m,
          items: [
            ...m.items,
            {
              id: crypto.randomUUID(),
              leftLabel: "左侧",
              rightLabel: "右侧",
              value: 50,
            } as BipolarSliderItem,
          ],
        })
      );
    } else if (m.type === "text-list") {
      add = addBtn(() =>
        replaceModule(m.id, {
          ...m,
          items: [
            ...m.items,
            { id: crypto.randomUUID(), title: "新条目", content: "" } as PreferenceItem,
          ],
        })
      );
    } else if (m.type === "radar" && m.axes.length < 8) {
      add = addBtn(() =>
        replaceModule(m.id, {
          ...m,
          axes: [
            ...m.axes,
            { id: crypto.randomUUID(), label: "新轴", value: 50 } as RadarAxis,
          ],
        })
      );
    }
    return (
      <>
        {add}
        {chromeBtn(
          m.width === "full" ? "半宽" : "全宽",
          () =>
            replaceModule(m.id, {
              ...m,
              width: m.width === "full" ? "half" : "full",
            } as SheetModule)
        )}
        {chromeBtn("↑", () => moveModule(m.id, -1), "上移")}
        {chromeBtn("↓", () => moveModule(m.id, 1), "下移")}
        {chromeBtn("×", () => commitModules(modules.filter((x) => x.id !== m.id)), "删除模块", true)}
      </>
    );
  };

  const renderModuleBody = (m: SheetModule) => {
    if (m.type === "sliders") {
      return (
        <TraitsList
          items={m.items}
          editable={editable}
          onChange={(next) => replaceModule(m.id, { ...m, items: next })}
        />
      );
    }
    if (m.type === "radar") {
      return (
        <div className="p-2 flex flex-col items-center justify-center min-h-full">
          <RadarChart
            axes={m.axes}
            size={Math.min(280, panelHeight - (editable ? 88 : 36))}
            onChange={
              editable
                ? (id, v) =>
                    replaceModule(m.id, {
                      ...m,
                      axes: m.axes.map((a) => (a.id === id ? { ...a, value: v } : a)),
                    })
                : undefined
            }
          />
          {editable && (
            <div className="w-full px-2 pb-2 space-y-1">
              {m.axes.map((ax) => (
                <div key={ax.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-transparent border-b border-neutral-700 text-xs text-neutral-300 outline-none"
                    value={ax.label}
                    onChange={(e) =>
                      replaceModule(m.id, {
                        ...m,
                        axes: m.axes.map((a) =>
                          a.id === ax.id ? { ...a, label: e.target.value } : a
                        ),
                      })
                    }
                  />
                  <span className="text-[10px] text-neutral-500 w-8 text-right tabular-nums">
                    {ax.value}
                  </span>
                  {m.axes.length > 3 && (
                    <button
                      type="button"
                      className="text-neutral-600 hover:text-rose-400 text-xs"
                      onClick={() =>
                        replaceModule(m.id, {
                          ...m,
                          axes: m.axes.filter((a) => a.id !== ax.id),
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (m.type === "text-list") {
      return (
        <div className="p-3 space-y-3">
          {m.items.map((pref) => (
            <div
              key={pref.id}
              className="relative group text-sm border-b border-neutral-800 pb-2 last:border-0"
            >
              {editable ? (
                <>
                  <input
                    className="w-full bg-transparent text-purple-400 font-medium outline-none mb-1"
                    value={pref.title}
                    onChange={(e) =>
                      replaceModule(m.id, {
                        ...m,
                        items: m.items.map((p) =>
                          p.id === pref.id ? { ...p, title: e.target.value } : p
                        ),
                      })
                    }
                  />
                  <textarea
                    className="w-full bg-transparent text-neutral-400 text-xs outline-none resize-none min-h-[48px]"
                    value={pref.content}
                    onChange={(e) =>
                      replaceModule(m.id, {
                        ...m,
                        items: m.items.map((p) =>
                          p.id === pref.id ? { ...p, content: e.target.value } : p
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      replaceModule(m.id, {
                        ...m,
                        items: m.items.filter((p) => p.id !== pref.id),
                      })
                    }
                    className="absolute top-0 right-0 text-neutral-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs px-1"
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <div className="text-purple-400 mb-1 font-medium">
                    {pref.title}
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    {pref.content || "—"}
                  </p>
                </>
              )}
            </div>
          ))}
          {m.items.length === 0 && (
            <p className="text-xs text-neutral-600">暂无条目</p>
          )}
        </div>
      );
    }
    return (
      <div className="p-3 h-full">
        {editable ? (
          <textarea
            className="w-full h-full min-h-[160px] bg-[#0a0a0a] border border-neutral-700 rounded p-3 text-sm text-neutral-300 outline-none focus:border-purple-500 leading-relaxed resize-none"
            value={m.body}
            onChange={(e) => replaceModule(m.id, { ...m, body: e.target.value })}
            placeholder="在此填写内容…"
          />
        ) : (
          <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {m.body || "—"}
          </div>
        )}
      </div>
    );
  };

  const addTemplates: { type: SheetModuleType; label: string }[] = [
    { type: "sliders", label: "滑块" },
    { type: "radar", label: "雷达图" },
    { type: "text-list", label: "文本列表" },
    { type: "text-long", label: "长文本" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 px-1 py-2 text-xs text-neutral-400 border border-neutral-800 rounded-lg bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <span className="shrink-0 w-14">缩放</span>
          <input
            type="range"
            min={70}
            max={140}
            step={5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="control-slider w-28"
          />
          <span className="tabular-nums w-10 text-neutral-300">{scale}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 w-14">分区高度</span>
          <input
            type="range"
            min={220}
            max={520}
            step={10}
            value={panelHeight}
            onChange={(e) => setPanelHeight(Number(e.target.value))}
            className="control-slider w-28"
          />
          <span className="tabular-nums w-12 text-neutral-300">{panelHeight}px</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setScale(100);
            setPanelHeight(340);
          }}
          className="ml-auto px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
        >
          重置
        </button>
      </div>

      <div
        style={{
          transform: `scale(${scale / 100})`,
          transformOrigin: "top left",
          width: `${10000 / scale}%`,
        }}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            <div className="lg:col-span-3">
              <Panel title="头像" height={h}>
                <div className="p-3 flex justify-center items-center h-full">
                  <AvatarUpload
                    src={c.avatar}
                    name={c.name}
                    onChange={
                      editable ? (b64) => update("avatar", b64) : undefined
                    }
                    size={avatarSize}
                  />
                </div>
              </Panel>
            </div>

            <div className="lg:col-span-4">
              <Panel title="基础信息" height={h}>
                <div className="p-3 space-y-2 text-sm">
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
                    onCreateOption={(v) =>
                      onAddOption?.(c.world || "", "genders", v)
                    }
                    editable={editable}
                  />
                  <OptionSelect
                    label="种族"
                    value={c.race}
                    options={optionsFor(c.world || "", "races")}
                    onChange={(v) => update("race", v)}
                    onCreateOption={(v) =>
                      onAddOption?.(c.world || "", "races", v)
                    }
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
                      <span className="w-14 text-neutral-500 shrink-0">
                        {label}:
                      </span>
                      {editable ? (
                        <input
                          className="flex-1 bg-transparent border-b border-neutral-700 focus:border-purple-500 outline-none px-1 py-0.5 text-neutral-200"
                          value={val}
                          onChange={(e) =>
                            update(
                              key as keyof Character,
                              e.target.value as never
                            )
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
                  <div className="flex gap-2 items-center">
                    <span className="w-14 text-neutral-500 shrink-0">身份:</span>
                    {editable ? (
                      <input
                        className="flex-1 bg-transparent border-b border-neutral-700 focus:border-purple-500 outline-none px-1 py-0.5 text-neutral-200"
                        value={c.identity}
                        onChange={(e) => update("identity", e.target.value)}
                      />
                    ) : (
                      <span className="text-neutral-200">{c.identity}</span>
                    )}
                  </div>
                  <OptionSelect
                    label="现住地"
                    value={c.residence || ""}
                    options={optionsFor(c.world || "", "residences")}
                    onChange={(v) => update("residence", v)}
                    onCreateOption={(v) =>
                      onAddOption?.(c.world || "", "residences", v)
                    }
                    editable={editable}
                  />
                  <OptionSelect
                    label="派系"
                    value={c.faction || ""}
                    options={optionsFor(c.world || "", "factions")}
                    onChange={(v) => update("faction", v)}
                    onCreateOption={(v) =>
                      onAddOption?.(c.world || "", "factions", v)
                    }
                    editable={editable}
                  />
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
              </Panel>
            </div>

            <div className="lg:col-span-5">
              <Panel title="故事经历" height={h}>
                <div className="p-3 h-full">
                  {editable ? (
                    <textarea
                      className="w-full h-full min-h-[160px] bg-[#0a0a0a] border border-neutral-700 rounded p-3 text-sm text-neutral-300 outline-none focus:border-purple-500 leading-relaxed resize-none"
                      value={c.story}
                      onChange={(e) => update("story", e.target.value)}
                      placeholder="在此填写角色的故事经历…"
                    />
                  ) : (
                    <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {c.story || "暂无故事经历"}
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {modules.map((m) => (
              <div
                key={m.id}
                className={m.width === "full" ? "lg:col-span-12" : "lg:col-span-6"}
              >
                <Panel
                  title={moduleTitle(m)}
                  height={h}
                  actions={moduleActions(m)}
                >
                  {renderModuleBody(m)}
                </Panel>
              </div>
            ))}
          </div>

          {editable && (
            <div className="flex flex-wrap items-center gap-2 px-1 py-2 border border-dashed border-neutral-800 rounded-lg">
              <span className="text-xs text-neutral-500">添加模块</span>
              {addTemplates.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => commitModules([...modules, createSheetModule(t.type)])}
                  className="px-2.5 py-1 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
