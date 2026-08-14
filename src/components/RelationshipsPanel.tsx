"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [form, setForm] = useState({
    targetId: "",
    type: "friend" as Relationship["type"],
    strength: 3,
    note: "",
  });

  const handleSubmit = () => {
    if (!form.targetId || form.targetId === character.id) return;
    onAdd(form);
    setForm({ targetId: "", type: "friend", strength: 3, note: "" });
    setShowForm(false);
  };

  const others = useMemo(
    () => allCharacters.filter((c) => c.id !== character.id),
    [allCharacters, character.id]
  );

  const graphCharacters = useMemo(() => {
    const byId = new Map<string, Character>();
    for (const c of allCharacters) byId.set(c.id, c);
    byId.set(character.id, character);

    const ids = new Set<string>([character.id]);

    for (const r of character.relationships || []) {
      if (r.targetId && r.targetId !== character.id) ids.add(r.targetId);
    }
    for (const c of allCharacters) {
      if (c.id === character.id) continue;
      if ((c.relationships || []).some((r) => r.targetId === character.id)) {
        ids.add(c.id);
      }
    }

    const world = character.world?.trim();
    if (world) {
      for (const c of allCharacters) {
        if (c.world?.trim() === world) ids.add(c.id);
      }
    }

    const self = byId.get(character.id)!;
    const rest = [...ids]
      .filter((id) => id !== character.id)
      .map((id) => byId.get(id))
      .filter((c): c is Character => Boolean(c))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [self, ...rest];
  }, [allCharacters, character]);

  const relList = useMemo(
    () =>
      (character.relationships || []).filter(
        (r) => r.targetId && r.targetId !== character.id
      ),
    [character.relationships, character.id]
  );

  const goToCharacter = (cid: string) => {
    if (cid === character.id) return;
    router.push(`/character/${cid}`);
  };

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
            当前角色在中心 · 点击其他节点进入角色卡
          </span>
        </div>

        {showGraph && (
          <RelationshipGraph
            characters={graphCharacters}
            focusId={character.id}
            height={360}
            storageKey={`oc-rel-graph-v2-${character.world || "all"}`}
            onNodeClick={goToCharacter}
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

        {relList.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">
            暂无关系。添加后会同步出现在对方角色卡上。
          </p>
        ) : (
          <div className="space-y-2">
            {relList.map((rel) => {
              const target = allCharacters.find((c) => c.id === rel.targetId);
              return (
                <div
                  key={rel.id}
                  className="group flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-900/60 border border-transparent hover:border-neutral-800"
                >
                  {target ? (
                    <Link
                      href={`/character/${target.id}`}
                      className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0 hover:opacity-90"
                      style={{
                        boxShadow: `0 0 0 2px ${REL_TYPE_COLORS[rel.type]}`,
                      }}
                      title={`打开 ${target.name}`}
                    >
                      {target.avatar ? (
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
                    </Link>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0 flex items-center justify-center text-neutral-500 text-xs">
                      ?
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {target ? (
                        <Link
                          href={`/character/${target.id}`}
                          className="font-medium text-sm truncate text-white hover:text-purple-300 hover:underline"
                        >
                          {target.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-sm truncate text-neutral-500">
                          Unknown
                        </span>
                      )}
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
