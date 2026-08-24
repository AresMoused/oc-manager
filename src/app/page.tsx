"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import { WORLD_COLOR_PALETTE, WORLD_SYSTEMS, worldSystemLabel, type WorldSystem } from "@/lib/worlds";
import {
  exportFullDatabase,
  importFullDatabase,
  downloadExport,
} from "@/lib/storage";
import { useWorldCatalog } from "@/hooks/useWorldCatalog";
import { useAppData } from "@/context/AppDataContext";

export default function WorldsHomePage() {
  const router = useRouter();
  const { worlds, loaded, addWorld, updateWorld, deleteWorld } = useWorlds();
  const { characters, updateCharacter } = useCharacters();
  const { catalog } = useWorldCatalog();
  const { flush } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(WORLD_COLOR_PALETTE[0]);
  const [system, setSystem] = useState<WorldSystem>("generic");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSystem, setEditSystem] = useState<WorldSystem>("generic");

  const worldNames = useMemo(
    () => new Set(worlds.map((w) => w.name.trim()).filter(Boolean)),
    [worlds]
  );

  const countInWorld = (worldName: string) =>
    characters.filter((c) => c.world?.trim() === worldName).length;

  const unassigned = useMemo(
    () =>
      characters.filter((c) => {
        const w = c.world?.trim() || "";
        return !w || !worldNames.has(w);
      }),
    [characters, worldNames]
  );

  const handleCreate = () => {
    if (!name.trim()) return;
    addWorld(name.trim(), color, system);
    setName("");
    setSystem("generic");
    setShowCreate(false);
  };

  const startEdit = (id: string, n: string, c: string, s?: WorldSystem) => {
    setEditingId(id);
    setEditName(n);
    setEditColor(c);
    setEditSystem(s || "generic");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateWorld(editingId, {
      name: editName.trim(),
      color: editColor,
      system: editSystem,
    });
    setEditingId(null);
  };

  const handleExportAll = () => {
    const data = exportFullDatabase({ characters, worlds, catalog });
    downloadExport(
      `oc-database-${new Date().toISOString().slice(0, 10)}.json`,
      data
    );
  };

  const handleImportAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = importFullDatabase(reader.result as string);
        if (
          !confirm(
            `导入整个数据库？\n将替换当前全部世界与角色（${parsed.characters.length} 角色 / ${parsed.worlds.length} 世界）。`
          )
        ) {
          return;
        }
        await flush({
          characters: parsed.characters,
          worlds: parsed.worlds as typeof worlds,
          catalog: (parsed.catalog || {}) as typeof catalog,
        });
        alert("数据库已导入");
      } catch (err) {
        alert(err instanceof Error ? err.message : "导入失败：无效 JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const assignToWorld = (characterId: string, worldName: string) => {
    updateCharacter(characterId, { world: worldName });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">世界 / Worlds</h1>
            <p className="text-neutral-500 text-sm mt-1">
              选择一个世界进入 · 角色、关系图按世界独立管理
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportAll}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              导出整个数据库
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              导入整个数据库
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportAll}
            />
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span> New World
            </button>
          </div>
        </div>

        {!loaded ? (
          <div className="text-center py-20 text-neutral-500">Loading...</div>
        ) : (
          <>
            {worlds.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-neutral-800 rounded-xl mb-10">
                <p className="text-4xl mb-3">🌍</p>
                <p className="text-neutral-400 mb-1">还没有世界</p>
                <p className="text-neutral-600 text-sm mb-6">
                  创建一个世界开始管理角色与关系
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
                >
                  Create first world
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {worlds.map((w) => (
                  <div
                    key={w.id}
                    className="group bg-[#111] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/world/${w.id}`)}
                      className="w-full text-left p-5 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: w.color }}
                        />
                        <h3 className="font-semibold text-white truncate text-lg">
                          {w.name}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {countInWorld(w.name)} 角色 · {worldSystemLabel(w.system)}
                      </p>
                    </button>
                    <div className="px-5 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(w.id, w.name, w.color, w.system);
                        }}
                        className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/world/${w.id}/dm`);
                        }}
                        className="text-xs text-amber-300 hover:text-white px-2 py-1 rounded border border-amber-800"
                      >
                        DM
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Delete world "${w.name}"?\nCharacters will become unassigned (not deleted).`
                            )
                          ) {
                            deleteWorld(w.id);
                          }
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded border border-neutral-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                    未分配世界 / Unassigned
                  </h2>
                  <p className="text-neutral-500 text-xs mt-1">
                    没有所属世界，或所属世界已被删除的角色
                  </p>
                </div>
                <span className="text-sm text-amber-400/90 tabular-nums">
                  {unassigned.length} 角色
                </span>
              </div>

              {unassigned.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-600">
                  没有未分配的角色
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unassigned.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-amber-900/40 hover:border-amber-700/60 transition"
                    >
                      <Link
                        href={`/character/${c.id}`}
                        className="flex items-center gap-3 min-w-0 flex-1"
                      >
                        <div className="w-11 h-11 rounded-full bg-neutral-800 overflow-hidden shrink-0 ring-1 ring-amber-800/50">
                          {c.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                              ?
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {c.name || "未命名"}
                          </p>
                          <p className="text-[11px] text-amber-500/80 truncate">
                            {c.world?.trim()
                              ? `原世界已失效：${c.world}`
                              : "未设置世界"}
                          </p>
                        </div>
                      </Link>
                      {worlds.length > 0 && (
                        <select
                          className="max-w-[120px] shrink-0 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-[11px] text-neutral-300 outline-none focus:border-purple-500"
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) assignToWorld(c.id, v);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">分配到…</option>
                          {worlds.map((w) => (
                            <option key={w.id} value={w.name}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">创建世界</h2>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">名称</label>
              <input
                autoFocus
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：绿叶边境"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-2">主题色</label>
              <div className="flex flex-wrap gap-2">
                {WORLD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition ${
                      color === c
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#111] scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">世界类型</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200"
                value={system}
                onChange={(e) => setSystem(e.target.value as WorldSystem)}
              >
                {WORLD_SYSTEMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-white"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">编辑世界</h2>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">名称</label>
              <input
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-2">主题色</label>
              <div className="flex flex-wrap gap-2">
                {WORLD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={`w-8 h-8 rounded-full transition ${
                      editColor === c
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#111] scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">世界类型</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200"
                value={editSystem}
                onChange={(e) => setEditSystem(e.target.value as WorldSystem)}
              >
                {WORLD_SYSTEMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
