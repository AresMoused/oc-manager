"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import { WORLD_COLOR_PALETTE } from "@/lib/worlds";

export default function WorldsHomePage() {
  const router = useRouter();
  const { worlds, loaded, addWorld, updateWorld, deleteWorld } = useWorlds();
  const { characters } = useCharacters();

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
    const w = addWorld(name.trim(), color);
    setName("");
    setShowCreate(false);
    router.push(`/world/${w.id}`);
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
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> New World
          </button>
        </div>

        {!loaded ? (
          <div className="text-center py-20 text-neutral-500">Loading...</div>
        ) : worlds.length === 0 ? (
          <div className="text-center py-20">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {worlds.map((w) => (
              <div
                key={w.id}
                className="group relative bg-[#111] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all"
                style={{ borderTopColor: w.color, borderTopWidth: 3 }}
              >
                <button
                  onClick={() => router.push(`/world/${w.id}`)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: w.color }}
                    />
                    <h3 className="font-semibold text-white truncate text-lg">
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
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
