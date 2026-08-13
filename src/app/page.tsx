"use client";

import { useRef, useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import Footer from "@/components/Footer";
import { useCharacters } from "@/hooks/useCharacters";
import { exportByWorld, importCharacters } from "@/lib/storage";

export default function HomePage() {
  const {
    characters,
    loaded,
    addCharacter,
    deleteCharacter,
    replaceAll,
  } = useCharacters();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeWorld, setActiveWorld] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const worldFolders = useMemo(() => {
    const map = new Map<string, number>();
    let unassigned = 0;
    characters.forEach((c) => {
      const w = c.world?.trim();
      if (!w) {
        unassigned++;
        return;
      }
      map.set(w, (map.get(w) || 0) + 1);
    });
    const folders = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { folders, unassigned };
  }, [characters]);

  const filtered = useMemo(() => {
    if (activeWorld === null) return [];
    if (activeWorld === "__none__")
      return characters.filter((c) => !c.world?.trim());
    return characters.filter((c) => c.world?.trim() === activeWorld);
  }, [characters, activeWorld]);

  const handleExport = () => {
    const data = exportByWorld(characters);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oc-manager-worlds-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const chars = importCharacters(reader.result as string);
        if (
          confirm(
            `Import ${chars.length} characters? This will replace current data.`
          )
        ) {
          replaceAll(chars);
          setActiveWorld(null);
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreate = (data: { name: string; world: string }) => {
    const id = addCharacter({ name: data.name, world: data.world });
    setActiveWorld(data.world);
    window.location.href = `/character/${id}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            {activeWorld !== null ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveWorld(null)}
                  className="text-neutral-400 hover:text-white text-sm transition"
                >
                  ← Worlds
                </button>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="text-purple-400">📁</span>
                  {activeWorld === "__none__" ? "Unassigned" : activeWorld}
                </h1>
                <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
                  {filtered.length} characters
                </span>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">Worlds</h1>
                <p className="text-neutral-500 text-sm mt-1">
                  按世界分区管理角色 · Characters organized by world folders
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              Export JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span> New Character
            </button>
          </div>
        </div>

        {!loaded ? (
          <div className="text-center py-20 text-neutral-500">Loading...</div>
        ) : activeWorld === null ? (
          <div>
            {worldFolders.folders.length === 0 && worldFolders.unassigned === 0 ? (
              <div className="text-center py-20">
                <p className="text-neutral-500 mb-2 text-4xl">📁</p>
                <p className="text-neutral-400 mb-1">还没有世界</p>
                <p className="text-neutral-600 text-sm mb-6">
                  创建第一个角色时会同时建立世界分区
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
                >
                  Create your first OC
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {worldFolders.folders.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setActiveWorld(f.name)}
                    className="group text-left bg-[#111] border border-neutral-800 hover:border-purple-600/60 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-purple-900/20"
                  >
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">
                      📁
                    </div>
                    <h3 className="font-semibold text-white truncate group-hover:text-purple-300 transition">
                      {f.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      {f.count} character{f.count !== 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
                {worldFolders.unassigned > 0 && (
                  <button
                    onClick={() => setActiveWorld("__none__")}
                    className="group text-left bg-[#111] border border-neutral-800 hover:border-neutral-600 rounded-xl p-4 transition-all"
                  >
                    <div className="text-3xl mb-3 opacity-50">📂</div>
                    <h3 className="font-semibold text-neutral-400 truncate">
                      Unassigned
                    </h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      {worldFolders.unassigned} character
                      {worldFolders.unassigned !== 1 ? "s" : ""}
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-neutral-500 mb-4">此世界还没有角色</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm"
                >
                  + Add character to this world
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filtered.map((c) => (
                  <CharacterCard
                    key={c.id}
                    character={c}
                    onDelete={deleteCharacter}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />

      <CreateCharacterModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        existingWorlds={worldFolders.folders.map((f) => f.name)}
        defaultWorld={activeWorld}
      />
    </div>
  );
}
