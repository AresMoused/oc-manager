"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import CharacterSheet from "@/components/CharacterSheet";
import Timeline from "@/components/Timeline";
import RelationshipsPanel from "@/components/RelationshipsPanel";
import Gallery from "@/components/Gallery";
import PromptBank from "@/components/PromptBank";
import WorldSelect from "@/components/WorldSelect";
import { useCharacters } from "@/hooks/useCharacters";
import { useWorldCatalog } from "@/hooks/useWorldCatalog";
import { useWorlds } from "@/hooks/useWorlds";
import Footer from "@/components/Footer";
import {
  exportSingleCharacter,
  importCharacterPayload,
  downloadExport,
} from "@/lib/storage";

export default function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    characters,
    loaded,
    reload,
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

  const [retryCount, setRetryCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { worlds, createWorld, addFieldOption, optionsFor } = useWorldCatalog();
  const { getWorldByName } = useWorlds();

  const [tab, setTab] = useState<
    "sheet" | "gallery" | "timeline" | "relations"
  >("sheet");

  const character = getCharacter(id);

  useEffect(() => {
    if (!loaded || character || retryCount >= 8) return;
    const t = setTimeout(() => {
      reload().finally(() => setRetryCount((n) => n + 1));
    }, 250);
    return () => clearTimeout(t);
  }, [loaded, character, retryCount, reload]);

  if (!loaded || (!character && retryCount < 8)) {
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
            ← Back to Worlds
          </Link>
        </div>
      </div>
    );
  }

  const worldMeta = getWorldByName(character.world || "");
  const backHref = worldMeta ? `/world/${worldMeta.id}` : "/";
  const backLabel = worldMeta ? `← ${worldMeta.name}` : "← Worlds";

  const tabs = [
    { key: "sheet" as const, label: "Character Sheet" },
    { key: "gallery" as const, label: "Gallery" },
    { key: "timeline" as const, label: "Timeline" },
    { key: "relations" as const, label: "Relationships" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={worldMeta?.color} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={backHref}
              className="text-neutral-400 hover:text-white transition text-sm"
            >
              {backLabel}
            </Link>
            {worldMeta && (
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: worldMeta.color }}
              />
            )}
            <h1 className="text-xl font-bold text-white">{character.name}</h1>
            <span className="text-xs text-neutral-500 px-2 py-0.5 rounded bg-neutral-800">
              {character.race}
            </span>
            <WorldSelect
              value={character.world || ""}
              worlds={worlds}
              onChange={(w) => updateCharacter(id, { world: w })}
              onCreateWorld={createWorld}
              editable
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const data = exportSingleCharacter(character);
                downloadExport(
                  `oc-character-${character.name}-${new Date().toISOString().slice(0, 10)}.json`,
                  data
                );
              }}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              输出角色卡
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
            >
              输入角色卡
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const list = importCharacterPayload(
                      reader.result as string
                    );
                    if (!list.length) {
                      alert("文件中没有角色卡");
                      return;
                    }
                    const src = list[0];
                    if (
                      !confirm(
                        `用「${src.name}」覆盖当前角色卡「${character.name}」？\n（保留当前 ID 与世界归属）`
                      )
                    ) {
                      return;
                    }
                    updateCharacter(id, {
                      name: src.name,
                      gender: src.gender,
                      age: src.age,
                      race: src.race,
                      height: src.height,
                      weight: src.weight,
                      affiliation: src.affiliation,
                      identity: src.identity,
                      residence: src.residence,
                      faction: src.faction,
                      birthplace: src.birthplace,
                      avatar: src.avatar,
                      traits: src.traits,
                      emotions: src.emotions,
                      combat: src.combat,
                      happiness: src.happiness,
                      preferences: src.preferences,
                      outward: src.outward,
                      story: src.story,
                      timeline: src.timeline,
                      relationships: src.relationships,
                      gallery: src.gallery,
                      prompts: src.prompts,
                      world: character.world || src.world || "",
                    });
                    alert("角色卡已导入");
                  } catch {
                    alert("导入失败：无效 JSON");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={async () => {
                if (
                  confirm(
                    `Delete ${character.name}? This cannot be undone.`
                  )
                ) {
                  await deleteCharacter(id);
                }
              }}
              className="px-3 py-1.5 text-sm text-rose-400 border border-rose-900/50 rounded-lg hover:bg-rose-950/30 transition"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-neutral-800 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm whitespace-nowrap transition border-b-2 -mb-px ${
                tab === t.key
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
              style={
                tab === t.key && worldMeta
                  ? { borderColor: worldMeta.color, color: worldMeta.color }
                  : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sheet" && (
          <CharacterSheet
            character={character}
            onChange={(u) => updateCharacter(id, u)}
            worlds={worlds}
            optionsFor={optionsFor}
            onCreateWorld={createWorld}
            onAddOption={addFieldOption}
          />
        )}
        {tab === "gallery" && (
          <>
            <PromptBank
              prompts={character.prompts || []}
              onChange={(prompts) => updateCharacter(id, { prompts })}
              editable
            />
            <Gallery
              images={character.gallery || []}
              onChange={(gallery) => updateCharacter(id, { gallery })}
              editable
            />
          </>
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
            allCharacters={characters.filter(
              (c) =>
                c.id !== id &&
                c.world?.trim() === (character.world || "").trim()
            )}
            onAdd={(rel) => addRelationship(id, rel)}
            onUpdate={(rid, u) => updateRelationship(id, rid, u)}
            onDelete={(rid) => deleteRelationship(id, rid)}
            editable
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
