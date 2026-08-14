"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import { WORLD_COLOR_PALETTE } from "@/lib/worlds";
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
  const { characters } = useCharacters();
  const { catalog } = useWorldCatalog();
  const { flush } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(WORLD_COLOR_PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const countInWorld = (worldName: string) =>
    characters.filter((c) => c.world?.trim() === worldName).length;

  const handleCreate = () => {
    if (!name.trim()) return;
    addWorld(name.trim(), color);
    setName("");
    setShowCreate(false);
  };

  const startEdit = (id: string, n: string, c: string) => {
    setEditingId(id);
    setEditName(n);
    setEditColor(c);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateWorld(editingId, { name: editName.trim(), color: editColor });
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Worlds</h1>
            <p className="text-neutral-500 text-sm mt-1">
              选择或创建世界；每个世界独立存放角色与关系。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium"
            >
              + New World
            </button>
            <button
              onClick={handleExportAll}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              输出整个数据库
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              输入整个数据库
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportAll}
            />
          </div>
        </div>

        {!loaded ? (
          <div className="text-center py-16 text-neutral-500">Loading...</div>
        ) : worlds.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">还没有世界</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm"
            >
              + Create world
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {worlds.map((w) => (
              <div
                key={w.id}
                className="group bg-[#111] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/world/${w.id}`)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: w.color }}
                    />
                    <h3 className="text-lg font-semibold text-white truncate">
                      {w.name}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {countInWorld(w.name)} character
                    {countInWorld(w.name) !== 1 ? "s" : ""}
                  </p>
                </button>
                <div className="px-5 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(w.id, w.name, w.color);
                    }}
                    className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-700"
                  >
                    Edit
                  </button>
                  <button
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
      </main>
      <Footer />

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">新建世界</h2>
            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
              placeholder="世界名称..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div>
              <p className="text-xs text-neutral-500 mb-2">颜色</p>
              <div className="flex flex-wrap gap-2">
                {WORLD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      color === c ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white disabled:opacity-40"
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
            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            />
            <div className="flex flex-wrap gap-2">
              {WORLD_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${
                    editColor === c
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white"
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
