"use client";

import { useRef, useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import CharacterCard from "@/components/CharacterCard";
import { useCharacters } from "@/hooks/useCharacters";
import { exportCharacters, importCharacters } from "@/lib/storage";

export default function HomePage() {
  const {
    characters,
    loaded,
    addCharacter,
    deleteCharacter,
    replaceAll,
  } = useCharacters();
  const fileRef = useRef<HTMLInputElement>(null);
  const [worldFilter, setWorldFilter] = useState<string>("all");

  const worlds = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((c) => {
      if (c.world?.trim()) set.add(c.world.trim());
    });
    return Array.from(set).sort();
  }, [characters]);

  const filtered = useMemo(() => {
    if (worldFilter === "all") return characters;
    if (worldFilter === "__none__") return characters.filter((c) => !c.world?.trim());
    return characters.filter((c) => c.world?.trim() === worldFilter);
  }, [characters, worldFilter]);

  const handleExport = () => {
    const data = exportCharacters(characters);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oc-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
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
        }
      } catch {
        alert("Invalid JSON file");
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
            <h1 className="text-2xl font-bold text-white">Characters</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Manage your original characters for TRPG campaigns
            </p>
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
              onClick={() => {
                const id = addCharacter();
                window.location.href = `/character/${id}`;
              }}
              className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span> New Character
            </button>
          </div>
        </div>

        {!loaded ? (
          <div className="text-center py-20 text-neutral-500">Loading...</div>
        ) : characters.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 mb-4">No characters yet.</p>
            <button
              onClick={() => {
                const id = addCharacter();
                window.location.href = `/character/${id}`;
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
            >
              Create your first OC
            </button>
          </div>
        ) : (
          <>
          {/* World filter tabs */}
          {(worlds.length > 0 || characters.some((c) => !c.world?.trim())) && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setWorldFilter("all")}
                className={`px-3 py-1 rounded-full text-xs transition ${
                  worldFilter === "all"
                    ? "bg-purple-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                All ({characters.length})
              </button>
              {worlds.map((w) => (
                <button
                  key={w}
                  onClick={() => setWorldFilter(w)}
                  className={`px-3 py-1 rounded-full text-xs transition ${
                    worldFilter === w
                      ? "bg-purple-600 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {w} ({characters.filter((c) => c.world?.trim() === w).length})
                </button>
              ))}
              {characters.some((c) => !c.world?.trim()) && (
                <button
                  onClick={() => setWorldFilter("__none__")}
                  className={`px-3 py-1 rounded-full text-xs transition ${
                    worldFilter === "__none__"
                      ? "bg-purple-600 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  Unassigned ({characters.filter((c) => !c.world?.trim()).length})
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onDelete={deleteCharacter}
              />
            ))}
          </div>
          </>
        )}
      </main>
    </div>
  );
}
