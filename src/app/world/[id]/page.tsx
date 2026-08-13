"use client";

import { use, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CharacterCard from "@/components/CharacterCard";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import { exportByWorld, importCharacters } from "@/lib/storage";

export default function WorldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getWorld, loaded: worldsLoaded } = useWorlds();
  const {
    characters,
    loaded: charsLoaded,
    addCharacter,
    deleteCharacter,
    replaceAll,
  } = useCharacters();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const world = getWorld(id);
  const loaded = worldsLoaded && charsLoaded;

  const worldChars = useMemo(() => {
    if (!world) return [];
    return characters.filter((c) => c.world?.trim() === world.name);
  }, [characters, world]);

  const handleCreate = () => {
    if (!world || !newName.trim()) return;
    const charId = addCharacter({ name: newName.trim(), world: world.name });
    setCreating(false);
    setNewName("");
    router.push(`/character/${charId}`);
  };

  const handleExport = () => {
    if (!world) return;
    const data = exportByWorld(worldChars);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oc-${world.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !world) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importCharacters(reader.result as string).map((c) => ({
          ...c,
          world: world.name,
        }));
        if (
          confirm(
            `Import ${imported.length} characters into "${world.name}"? Existing characters in other worlds are kept.`
          )
        ) {
          const others = characters.filter(
            (c) => c.world?.trim() !== world.name
          );
          replaceAll([...others, ...imported]);
        }
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          Loading...
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-neutral-400">World not found</p>
          <Link href="/" className="text-purple-400 hover:underline text-sm">
            ← Back to Worlds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={world.color} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-neutral-400 hover:text-white text-sm transition"
            >
              ← Worlds
            </Link>
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: world.color }}
            />
            <h1 className="text-2xl font-bold text-white">{world.name}</h1>
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
              {worldChars.length} characters
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/world/${id}/relationships`}
              className="px-3 py-1.5 text-sm border rounded-lg transition"
              style={{ borderColor: world.color + "66", color: world.color }}
            >
              Relationship Map
            </Link>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-1.5 text-sm rounded-lg text-white font-medium transition flex items-center gap-1.5"
              style={{ backgroundColor: world.color }}
            >
              <span className="text-lg leading-none">+</span> New Character
            </button>
          </div>
        </div>

        {worldChars.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">此世界还没有角色</p>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: world.color }}
            >
              + Add character
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {worldChars.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onDelete={deleteCharacter}
                accentColor={world.color}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">新建角色</h2>
            <div
              className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
              style={{
                backgroundColor: world.color + "22",
                color: world.color,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: world.color }}
              />
              {world.name}
            </div>
            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
              placeholder="角色姓名..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-40"
                style={{ backgroundColor: world.color }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
