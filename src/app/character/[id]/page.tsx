"use client";

import { use, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import CharacterSheet from "@/components/CharacterSheet";
import Timeline from "@/components/Timeline";
import RelationshipsPanel from "@/components/RelationshipsPanel";
import { useCharacters } from "@/hooks/useCharacters";

export default function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    characters,
    loaded,
    getCharacter,
    updateCharacter,
    deleteCharacter,
    addTimelineEvent,
    updateTimelineEvent,
    deleteTimelineEvent,
    addRelationship,
    updateRelationship,
    deleteRelationship,
  } = useCharacters();

  const [tab, setTab] = useState<"sheet" | "timeline" | "relations">("sheet");
  const character = getCharacter(id);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-neutral-400">Character not found</p>
          <Link href="/" className="text-purple-400 hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-neutral-400 hover:text-white transition text-sm"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-white">{character.name}</h1>
            <span className="text-xs text-neutral-500 px-2 py-0.5 rounded bg-neutral-800">
              {character.race}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm(`Delete ${character.name}? This cannot be undone.`)) {
                  deleteCharacter(id);
                  window.location.href = "/";
                }
              }}
              className="px-3 py-1.5 text-sm text-rose-400 border border-rose-900/50 rounded-lg hover:bg-rose-950/30 transition"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-neutral-800">
          {(
            [
              ["sheet", "Character Sheet"],
              ["timeline", "Timeline"],
              ["relations", "Relationships"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition border-b-2 -mb-px ${
                tab === key
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "sheet" && (
          <CharacterSheet
            character={character}
            onChange={(updates) => updateCharacter(id, updates)}
            editable
          />
        )}
        {tab === "timeline" && (
          <Timeline
            events={character.timeline}
            onAdd={(ev) => addTimelineEvent(id, ev)}
            onUpdate={(eid, u) => updateTimelineEvent(id, eid, u)}
            onDelete={(eid) => deleteTimelineEvent(id, eid)}
            editable
          />
        )}
        {tab === "relations" && (
          <RelationshipsPanel
            character={character}
            allCharacters={characters}
            onAdd={(rel) => addRelationship(id, rel)}
            onUpdate={(rid, u) => updateRelationship(id, rid, u)}
            onDelete={(rid) => deleteRelationship(id, rid)}
            editable
          />
        )}
      </main>
    </div>
  );
}
