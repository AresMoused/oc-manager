"use client";

import { useState } from "react";
import { Character, Relationship } from "@/lib/types";
import SectionHeader from "./SectionHeader";

interface Props {
  character: Character;
  allCharacters: Character[];
  onAdd: (rel: Omit<Relationship, "id">) => void;
  onUpdate: (id: string, updates: Partial<Relationship>) => void;
  onDelete: (id: string) => void;
  editable?: boolean;
}

const TYPE_LABELS: Record<Relationship["type"], string> = {
  friend: "Friend 友",
  family: "Family 亲",
  ally: "Ally 盟",
  enemy: "Enemy 敌",
  rival: "Rival 竞",
  lover: "Lover 恋",
  mentor: "Mentor 师",
  other: "Other 其他",
};

const TYPE_COLORS: Record<Relationship["type"], string> = {
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

  return (
    <div>
      <SectionHeader
        title="人际关系 / Relationships"
        onAdd={editable ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-4">
        {showForm && (
          <div className="mb-4 p-3 bg-[#0a0a0a] border border-purple-800/50 rounded-lg space-y-2">
            <select
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={form.targetId}
              onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            >
              <option value="">Select character...</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as Relationship["type"],
                  })
                }
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">Strength</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.strength}
                  onChange={(e) =>
                    setForm({ ...form, strength: Number(e.target.value) })
                  }
                  className="flex-1"
                />
                <span className="text-xs w-4">{form.strength}</span>
              </div>
            </div>
            <input
              placeholder="Note (optional)"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {character.relationships.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">
            No relationships yet. Add connections to other characters.
          </p>
        ) : (
          <div className="space-y-2">
            {character.relationships.map((rel) => {
              const target = allCharacters.find((c) => c.id === rel.targetId);
              return (
                <div
                  key={rel.id}
                  className="flex items-center gap-3 p-2.5 bg-[#0a0a0a] border border-neutral-800 rounded-lg group"
                >
                  <div className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0">
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
                        className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[rel.type]}`}
                      >
                        {TYPE_LABELS[rel.type]}
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
                      onClick={() => onDelete(rel.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 text-xs transition"
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
