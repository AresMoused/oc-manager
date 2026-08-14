"use client";

import { useMemo, useState } from "react";
import { Character, Relationship } from "@/lib/types";
import SectionHeader from "./SectionHeader";
import RelationshipGraph, {
  REL_TYPE_COLORS,
  REL_TYPE_LABELS,
} from "./RelationshipGraph";

interface Props {
  character: Character;
  allCharacters: Character[];
  onAdd: (rel: Omit<Relationship, "id">) => void;
  onUpdate: (id: string, updates: Partial<Relationship>) => void;
  onDelete: (id: string) => void;
  editable?: boolean;
}

const TYPE_BADGE: Record<Relationship["type"], string> = {
  friend: "bg-emerald-900/40 text-emerald-300",
  family: "bg-sky-900/40 text-sky-300",
  ally: "bg-blue-900/40 text-blue-300",
  enemy: "bg-rose-900/40 text-rose-300",
  rival: "bg-amber-900/40 text-amber-300",
  lover: "bg-pink-900/40 text-pink-300",
  mentor: "bg-violet-900/40 text-violet-300",
  other: "bg-neutral-800 text-neutral-300",
};

export default function RelationshipsPanel({
  character,
  allCharacters,
  onAdd,
  onUpdate,
  onDelete,
  editable = true,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [form, setForm] = useState({
    targetId: "",
    type: "friend" as Relationship["type"],
    strength: 3,
    note: "",
  });

  const handleSubmit = () => {
    if (!form.targetId) return;
    onAdd(form);
    setForm({ targetId: "", type: "friend", strength: 3, note: "" });
    setShowForm(false);
  };

  const others = allCharacters.filter((c) => c.id !== character.id);

  const worldChars = useMemo(() => {
    const w = character.world?.trim();
    if (!w) return allCharacters;
    return allCharacters.filter((c) => c.world?.trim() === w);
  }, [allCharacters, character.world]);

  return (
    <div>
      <SectionHeader
        title="人际关系 / Relationships"
        onAdd={editable ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowGraph((v) => !v)}
            className="text-xs text-neutral-400 hover:text-white"
          >
            {showGraph ? "▾ 关系图" : "▸ 关系图"}
          </button>
          <span className="text-[10px] text-neutral-600">
            关系会自动同步到对方角色卡
          </span>
        </div>

        {showGraph && worldChars.length > 0 && (
          <RelationshipGraph
            characters={worldChars}
            focusId={character.id}
            height={320}
            storageKey={`oc-rel-graph-char-${character.id}`}
          />
        )}

        {showForm && (
          <div className="p-3 bg-[#0a0a0a] border border-purple-800/50 rounded-lg space-y-2">
            <select
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={form.targetId}
              onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            >
              <option value="">Select character...</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.world ? ` · ${o.world}` : ""}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as Relationship["type"],
                  })
                }
              >
                {(Object.keys(REL_TYPE_LABELS) as Relationship["type"][]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {REL_TYPE_LABELS[t]}
                    </option>
                  )
                )}
              </select>
              <div className="flex items-center gap-1 px-2">
                <span className="text-xs text-neutral-500">强度</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.strength}
                  onChange={(e) =>
                    setForm({ ...form, strength: Number(e.target.value) })
                  }
                  className="w-20 accent-purple-500"
                />
                <span className="text-xs text-purple-300 w-3">{form.strength}</span>
              </div>
            </div>
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              placeholder="备注（可选）"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-xs text-neutral-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-1 text-xs rounded bg-purple-600 text-white"
              >
                添加（双向同步）
              </button>
            </div>
          </div>
        )}

        {character.relationships.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">
            暂无关系。添加后会同步出现在对方角色卡上。
          </p>
        ) : (
          <div className="space-y-2">
            {character.relationships.map((rel) => {
              const target = allCharacters.find((c) => c.id === rel.targetId);
              return (
                <div
                  key={rel.id}
                  className="group flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-900/60 border border-transparent hover:border-neutral-800"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0"
                    style={{ boxShadow: `0 0 0 2px ${REL_TYPE_COLORS[rel.type]}` }}
                  >
                    {target?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={target.avatar}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {target?.name || "Unknown"}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[rel.type]}`}
                      >
                        {REL_TYPE_LABELS[rel.type]}
                      </span>
                    </div>
                    {rel.note && (
                      <p className="text-xs text-neutral-500 truncate">
                        {rel.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < rel.strength ? "bg-purple-400" : "bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onDelete(rel.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 text-xs transition"
                      title="同时从对方角色卡删除"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
