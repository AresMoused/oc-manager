"use client";

import { useMemo, useState } from "react";
import {
  WorldLore,
  LoreLocation,
  LoreFaction,
  LoreRule,
  LoreArtifact,
  LoreHistoryEvent,
  LoreRace,
  emptyLore,
  newId,
} from "@/lib/worldLore";

type Tab = "locations" | "factions" | "rules" | "artifacts" | "history" | "races";

const TABS: { id: Tab; label: string }[] = [
  { id: "locations", label: "地理与地点" },
  { id: "factions", label: "势力与组织" },
  { id: "rules", label: "核心法则" },
  { id: "artifacts", label: "奇物与装备" },
  { id: "history", label: "历史与大事记" },
  { id: "races", label: "种族与习俗" },
];

interface Props {
  worldName: string;
  lore: WorldLore;
  editable?: boolean;
  characterNames?: string[];
  onChange: (next: WorldLore) => void;
  onSyncHistoryToTimelines?: (
    events: LoreHistoryEvent[],
    previous: LoreHistoryEvent[]
  ) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs space-y-1">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-purple-500";
const taCls = `${inputCls} min-h-[64px] resize-y`;

export default function WorldLorePanel({
  worldName,
  lore,
  editable = true,
  characterNames = [],
  onChange,
  onSyncHistoryToTimelines,
}: Props) {
  const [tab, setTab] = useState<Tab>("locations");
  const [editingId, setEditingId] = useState<string | null>(null);
  const data = lore || emptyLore();

  const patch = <K extends keyof WorldLore>(key: K, list: WorldLore[K]) => {
    onChange({ ...data, [key]: list });
  };

  const list = useMemo(() => {
    switch (tab) {
      case "locations":
        return data.locations;
      case "factions":
        return data.factions;
      case "rules":
        return data.rules;
      case "artifacts":
        return data.artifacts;
      case "history":
        return data.history;
      case "races":
        return data.races;
    }
  }, [tab, data]);

  const addItem = () => {
    if (!editable) return;
    const id = newId();
    if (tab === "locations") {
      const item: LoreLocation = {
        id,
        name: "",
        type: "",
        climate: "",
        ruler: "",
        tags: [],
      };
      patch("locations", [...data.locations, item]);
    } else if (tab === "factions") {
      const item: LoreFaction = {
        id,
        name: "",
        emblem: "",
        headquarters: "",
        ideology: "",
        members: "",
        diplomacy: "",
      };
      patch("factions", [...data.factions, item]);
    } else if (tab === "rules") {
      const item: LoreRule = {
        id,
        name: "",
        source: "",
        cost: "",
        legalStatus: "",
      };
      patch("rules", [...data.rules, item]);
    } else if (tab === "artifacts") {
      const item: LoreArtifact = {
        id,
        name: "",
        maker: "",
        holder: "",
        power: "",
        cost: "",
      };
      patch("artifacts", [...data.artifacts, item]);
    } else if (tab === "history") {
      const item: LoreHistoryEvent = {
        id,
        era: "",
        name: "",
        cause: "",
        process: "",
        result: "",
        impact: "",
        participants: [],
      };
      patch("history", [...data.history, item]);
    } else {
      const item: LoreRace = { id, name: "", physiology: "", culture: "" };
      patch("races", [...data.races, item]);
    }
    setEditingId(id);
  };

  const removeItem = (id: string) => {
    if (!editable) return;
    if (tab === "locations")
      patch("locations", data.locations.filter((x) => x.id !== id));
    else if (tab === "factions")
      patch("factions", data.factions.filter((x) => x.id !== id));
    else if (tab === "rules")
      patch("rules", data.rules.filter((x) => x.id !== id));
    else if (tab === "artifacts")
      patch("artifacts", data.artifacts.filter((x) => x.id !== id));
    else if (tab === "history") {
      const prev = data.history;
      const next = prev.filter((x) => x.id !== id);
      patch("history", next);
      onSyncHistoryToTimelines?.(next, prev);
    } else patch("races", data.races.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateLocation = (id: string, partial: Partial<LoreLocation>) => {
    patch("locations", data.locations.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  };
  const updateFaction = (id: string, partial: Partial<LoreFaction>) => {
    patch("factions", data.factions.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  };
  const updateRule = (id: string, partial: Partial<LoreRule>) => {
    patch("rules", data.rules.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  };
  const updateArtifact = (id: string, partial: Partial<LoreArtifact>) => {
    patch("artifacts", data.artifacts.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  };
  const updateHistory = (id: string, partial: Partial<LoreHistoryEvent>) => {
    const prev = data.history;
    const next = prev.map((x) => (x.id === id ? { ...x, ...partial } : x));
    patch("history", next);
    onSyncHistoryToTimelines?.(next, prev);
  };
  const updateRace = (id: string, partial: Partial<LoreRace>) => {
    patch("races", data.races.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0d0d0d] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-neutral-800 bg-[#111]">
        <div>
          <h2 className="text-sm font-semibold text-white">世界观设定</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {worldName || "未命名世界"} · 地点 / 势力 / 法则 / 奇物 / 历史 / 种族
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white transition"
          >
            + 新增条目
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-neutral-800/80">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setEditingId(null);
            }}
            className={`px-3 py-1.5 text-xs rounded-t-md transition ${
              tab === t.id
                ? "bg-[#1a1a1a] text-purple-300 border border-neutral-700 border-b-transparent -mb-px"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
            <span className="ml-1 text-neutral-600">
              (
              {t.id === "locations"
                ? data.locations.length
                : t.id === "factions"
                  ? data.factions.length
                  : t.id === "rules"
                    ? data.rules.length
                    : t.id === "artifacts"
                      ? data.artifacts.length
                      : t.id === "history"
                        ? data.history.length
                        : data.races.length}
              )
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
        {list.length === 0 && (
          <p className="text-sm text-neutral-600 text-center py-8">
            暂无条目
            {editable ? "，点击右上角「新增条目」开始撰写" : ""}
          </p>
        )}

        {tab === "locations" &&
          data.locations.map((item) => {
            const open = editingId === item.id;
            return (
              <div
                key={item.id}
                id={`lore-loc-${encodeURIComponent(item.name)}`}
                className="rounded-lg border border-neutral-800 bg-[#111] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => setEditingId(open ? null : item.id)}
                  >
                    <div className="text-sm font-medium text-neutral-100">
                      {item.name || "（未命名地点）"}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {[item.type, item.ruler, item.tags.join(" · ")]
                        .filter(Boolean)
                        .join(" · ") || "点击展开"}
                    </div>
                  </button>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-neutral-600 hover:text-rose-400 text-xs px-1"
                    >
                      删除
                    </button>
                  )}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="名称">
                      <input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateLocation(item.id, { name: e.target.value })} />
                    </Field>
                    <Field label="类型（大陆/国家/城市/地下城…）">
                      <input className={inputCls} value={item.type} disabled={!editable} onChange={(e) => updateLocation(item.id, { type: e.target.value })} />
                    </Field>
                    <Field label="地理气候 / 特产">
                      <textarea className={taCls} value={item.climate} disabled={!editable} onChange={(e) => updateLocation(item.id, { climate: e.target.value })} />
                    </Field>
                    <Field label="统治者 / 所属势力">
                      <input className={inputCls} value={item.ruler} disabled={!editable} onChange={(e) => updateLocation(item.id, { ruler: e.target.value })} />
                    </Field>
                    <Field label="氛围标签（逗号分隔）">
                      <input className={inputCls} value={item.tags.join(", ")} disabled={!editable} onChange={(e) => updateLocation(item.id, { tags: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                    </Field>
                    <Field label="备注">
                      <textarea className={taCls} value={item.notes || ""} disabled={!editable} onChange={(e) => updateLocation(item.id, { notes: e.target.value })} />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}

        {tab === "factions" &&
          data.factions.map((item) => {
            const open = editingId === item.id;
            return (
              <div key={item.id} id={`lore-fac-${encodeURIComponent(item.name)}`} className="rounded-lg border border-neutral-800 bg-[#111] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setEditingId(open ? null : item.id)}>
                    <div className="text-sm font-medium text-neutral-100">{item.name || "（未命名势力）"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{item.headquarters || item.ideology || "点击展开"}</div>
                  </button>
                  {editable && (<button type="button" onClick={() => removeItem(item.id)} className="text-neutral-600 hover:text-rose-400 text-xs px-1">删除</button>)}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="名称"><input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateFaction(item.id, { name: e.target.value })} /></Field>
                    <Field label="徽章 / 图腾"><input className={inputCls} value={item.emblem} disabled={!editable} onChange={(e) => updateFaction(item.id, { emblem: e.target.value })} /></Field>
                    <Field label="总部所在地"><input className={inputCls} value={item.headquarters} disabled={!editable} onChange={(e) => updateFaction(item.id, { headquarters: e.target.value })} /></Field>
                    <Field label="核心宗旨 / 意识形态"><textarea className={taCls} value={item.ideology} disabled={!editable} onChange={(e) => updateFaction(item.id, { ideology: e.target.value })} /></Field>
                    <Field label="组织架构 / 核心成员"><textarea className={taCls} value={item.members} disabled={!editable} onChange={(e) => updateFaction(item.id, { members: e.target.value })} /></Field>
                    <Field label="外交关系"><textarea className={taCls} value={item.diplomacy} disabled={!editable} onChange={(e) => updateFaction(item.id, { diplomacy: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            );
          })}

        {tab === "rules" &&
          data.rules.map((item) => {
            const open = editingId === item.id;
            return (
              <div key={item.id} className="rounded-lg border border-neutral-800 bg-[#111] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setEditingId(open ? null : item.id)}>
                    <div className="text-sm font-medium text-neutral-100">{item.name || "（未命名法则）"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{item.legalStatus || item.cost || "点击展开"}</div>
                  </button>
                  {editable && (<button type="button" onClick={() => removeItem(item.id)} className="text-neutral-600 hover:text-rose-400 text-xs px-1">删除</button>)}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="体系名称"><input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateRule(item.id, { name: e.target.value })} /></Field>
                    <Field label="法律地位"><input className={inputCls} value={item.legalStatus} disabled={!editable} onChange={(e) => updateRule(item.id, { legalStatus: e.target.value })} /></Field>
                    <Field label="能量来源 / 运作原理"><textarea className={taCls} value={item.source} disabled={!editable} onChange={(e) => updateRule(item.id, { source: e.target.value })} /></Field>
                    <Field label="代价与限制"><textarea className={taCls} value={item.cost} disabled={!editable} onChange={(e) => updateRule(item.id, { cost: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            );
          })}

        {tab === "artifacts" &&
          data.artifacts.map((item) => {
            const open = editingId === item.id;
            return (
              <div key={item.id} className="rounded-lg border border-neutral-800 bg-[#111] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setEditingId(open ? null : item.id)}>
                    <div className="text-sm font-medium text-neutral-100">{item.name || "（未命名奇物）"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{[item.holder, item.maker].filter(Boolean).join(" · ") || "点击展开"}</div>
                  </button>
                  {editable && (<button type="button" onClick={() => removeItem(item.id)} className="text-neutral-600 hover:text-rose-400 text-xs px-1">删除</button>)}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="名称"><input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateArtifact(item.id, { name: e.target.value })} /></Field>
                    <Field label="制造者"><input className={inputCls} value={item.maker} disabled={!editable} onChange={(e) => updateArtifact(item.id, { maker: e.target.value })} /></Field>
                    <Field label="目前持有者"><input className={inputCls} value={item.holder} disabled={!editable} onChange={(e) => updateArtifact(item.id, { holder: e.target.value })} /></Field>
                    <Field label="异能描述"><textarea className={taCls} value={item.power} disabled={!editable} onChange={(e) => updateArtifact(item.id, { power: e.target.value })} /></Field>
                    <Field label="代价"><textarea className={taCls} value={item.cost} disabled={!editable} onChange={(e) => updateArtifact(item.id, { cost: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            );
          })}

        {tab === "history" &&
          data.history.map((item) => {
            const open = editingId === item.id;
            return (
              <div key={item.id} className="rounded-lg border border-neutral-800 bg-[#111] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setEditingId(open ? null : item.id)}>
                    <div className="text-sm font-medium text-neutral-100">{item.name || "（未命名事件）"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{[item.era, item.location, item.participants.join("、")].filter(Boolean).join(" · ") || "点击展开"}</div>
                  </button>
                  {editable && (<button type="button" onClick={() => removeItem(item.id)} className="text-neutral-600 hover:text-rose-400 text-xs px-1">删除</button>)}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="时间 / 纪元"><input className={inputCls} value={item.era} disabled={!editable} onChange={(e) => updateHistory(item.id, { era: e.target.value })} /></Field>
                    <Field label="事件名称"><input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateHistory(item.id, { name: e.target.value })} /></Field>
                    <Field label="发生地点"><input className={inputCls} value={item.location || ""} disabled={!editable} onChange={(e) => updateHistory(item.id, { location: e.target.value })} /></Field>
                    <Field label="参与角色（逗号分隔姓名，同步到人物时间线）">
                      <input className={inputCls} value={item.participants.join(", ")} disabled={!editable} list={`char-names-${item.id}`} onChange={(e) => updateHistory(item.id, { participants: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                      <datalist id={`char-names-${item.id}`}>{characterNames.map((n) => (<option key={n} value={n} />))}</datalist>
                    </Field>
                    <Field label="起因"><textarea className={taCls} value={item.cause} disabled={!editable} onChange={(e) => updateHistory(item.id, { cause: e.target.value })} /></Field>
                    <Field label="经过"><textarea className={taCls} value={item.process} disabled={!editable} onChange={(e) => updateHistory(item.id, { process: e.target.value })} /></Field>
                    <Field label="结果"><textarea className={taCls} value={item.result} disabled={!editable} onChange={(e) => updateHistory(item.id, { result: e.target.value })} /></Field>
                    <Field label="历史影响"><textarea className={taCls} value={item.impact} disabled={!editable} onChange={(e) => updateHistory(item.id, { impact: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            );
          })}

        {tab === "races" &&
          data.races.map((item) => {
            const open = editingId === item.id;
            return (
              <div key={item.id} id={`lore-race-${encodeURIComponent(item.name)}`} className="rounded-lg border border-neutral-800 bg-[#111] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left flex-1" onClick={() => setEditingId(open ? null : item.id)}>
                    <div className="text-sm font-medium text-neutral-100">{item.name || "（未命名种族）"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{item.physiology || item.culture || "点击展开"}</div>
                  </button>
                  {editable && (<button type="button" onClick={() => removeItem(item.id)} className="text-neutral-600 hover:text-rose-400 text-xs px-1">删除</button>)}
                </div>
                {open && (
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <Field label="种族 / 群体名称"><input className={inputCls} value={item.name} disabled={!editable} onChange={(e) => updateRace(item.id, { name: e.target.value })} /></Field>
                    <Field label="生理特征（寿命、外貌、天赋）"><textarea className={taCls} value={item.physiology} disabled={!editable} onChange={(e) => updateRace(item.id, { physiology: e.target.value })} /></Field>
                    <Field label="文化习俗（禁忌、节日、方言）"><textarea className={taCls} value={item.culture} disabled={!editable} onChange={(e) => updateRace(item.id, { culture: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
