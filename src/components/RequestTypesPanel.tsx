"use client";

import { useRef, useState } from "react";
import type { ChatPromptEntry } from "@/lib/characterChat";
import {
  allPacks,
  loadContextPacks,
  loadRequestTypes,
  parseContextPacks,
  saveContextPacks,
  saveRequestTypes,
  type ContextPack,
  type RequestType,
} from "@/lib/contextPacks";

export default function RequestTypesPanel({ onPing }: { onPing?: (m: string) => void }) {
  const [types, setTypes] = useState<RequestType[]>(() => loadRequestTypes());
  const [packs, setPacks] = useState(() => allPacks());
  const [editId, setEditId] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistTypes = (next: RequestType[]) => {
    setTypes(next);
    saveRequestTypes(next);
  };
  const refreshPacks = () => setPacks(allPacks());

  const userPacks = () => loadContextPacks();
  const editing = userPacks().find((p) => p.id === editId) || null;

  const savePack = (next: ContextPack) => {
    saveContextPacks(userPacks().map((p) => (p.id === next.id ? next : p)));
    refreshPacks();
  };

  const patchEntry = (id: string, patch: Partial<ChatPromptEntry>) => {
    if (!editing) return;
    savePack({
      ...editing,
      entries: editing.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-neutral-500">
        每种请求绑一套上下文预设。出图用「角色/服装展示」或「正文图片生成」。预设可点编辑改条目。
      </p>
      <div className="flex gap-2">
        <button type="button" className="px-2 py-1 rounded-lg border border-sky-800 text-sky-300" onClick={() => fileRef.current?.click()}>
          导入上下文预设
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const incoming = parseContextPacks(await f.text());
              const next = [...loadContextPacks(), ...incoming];
              saveContextPacks(next);
              refreshPacks();
              onPing?.(`已导入 ${incoming.map((p) => p.name).join("、")}`);
            } catch (err) {
              onPing?.(err instanceof Error ? err.message : "导入失败");
            }
          }}
        />
      </div>
      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="border border-neutral-800 rounded-xl px-2 py-2">
            <div className="text-neutral-100">{t.name}</div>
            <div className="text-neutral-500 mb-1">{t.blurb}</div>
            {t.id === "assistant" ? (
              <div className="text-neutral-400">使用「人设」页的陪玩姬稿</div>
            ) : (
              <label className="block text-neutral-400">
                上下文预设
                <select
                  className="mt-0.5 w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-200"
                  value={t.packId}
                  onChange={(e) =>
                    persistTypes(types.map((x) => (x.id === t.id ? { ...x, packId: e.target.value } : x)))
                  }
                >
                  <option value="">（不使用）</option>
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.entries.length} 条
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
      </div>
      {userPacks().length > 0 && (
        <div className="space-y-1">
          <div className="text-neutral-400">已导入的包</div>
          {userPacks().map((p) => (
            <div key={p.id} className="border border-neutral-800 rounded-lg px-2 py-1.5 space-y-1">
              <div className="flex items-center gap-2 text-neutral-300">
                <span className="flex-1 truncate">{p.name}</span>
                <button
                  type="button"
                  className="text-sky-300"
                  onClick={() => {
                    setEditId(editId === p.id ? null : p.id);
                    setOpenEntry(null);
                  }}
                >
                  {editId === p.id ? "收起" : "编辑"}
                </button>
                <button
                  type="button"
                  className="text-rose-400"
                  onClick={() => {
                    saveContextPacks(userPacks().filter((x) => x.id !== p.id));
                    persistTypes(types.map((t) => (t.packId === p.id ? { ...t, packId: "" } : t)));
                    if (editId === p.id) setEditId(null);
                    refreshPacks();
                  }}
                >
                  删
                </button>
              </div>
              {editId === p.id && editing && (
                <div className="space-y-1 pt-1">
                  <input
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                    value={editing.name}
                    onChange={(e) => savePack({ ...editing, name: e.target.value })}
                  />
                  {editing.entries.map((ent) => (
                    <div key={ent.id} className="border border-neutral-800 rounded px-1.5 py-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={ent.enabled}
                          onChange={() => patchEntry(ent.id, { enabled: !ent.enabled })}
                        />
                        <button
                          type="button"
                          className="flex-1 text-left text-neutral-200 truncate"
                          onClick={() => setOpenEntry(openEntry === ent.id ? null : ent.id)}
                        >
                          {ent.name}
                          <span className="text-neutral-600 ml-1">{ent.role}</span>
                        </button>
                        <button
                          type="button"
                          className="text-rose-400"
                          onClick={() =>
                            savePack({ ...editing, entries: editing.entries.filter((x) => x.id !== ent.id) })
                          }
                        >
                          删
                        </button>
                      </div>
                      {openEntry === ent.id && (
                        <div className="mt-1 space-y-1">
                          <input
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                            value={ent.name}
                            onChange={(e) => patchEntry(ent.id, { name: e.target.value })}
                          />
                          <select
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                            value={ent.role}
                            onChange={(e) =>
                              patchEntry(ent.id, { role: e.target.value as ChatPromptEntry["role"] })
                            }
                          >
                            <option value="system">system</option>
                            <option value="user">user</option>
                            <option value="assistant">assistant</option>
                          </select>
                          <textarea
                            className="w-full min-h-[100px] bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200 font-mono"
                            value={ent.content}
                            onChange={(e) => patchEntry(ent.id, { content: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sky-300"
                    onClick={() => {
                      const e: ChatPromptEntry = {
                        id: crypto.randomUUID(),
                        identifier: "",
                        name: "新条目",
                        role: "user",
                        content: "",
                        enabled: true,
                        marker: false,
                      };
                      savePack({ ...editing, entries: [...editing.entries, e] });
                      setOpenEntry(e.id);
                    }}
                  >
                    + 条目
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}