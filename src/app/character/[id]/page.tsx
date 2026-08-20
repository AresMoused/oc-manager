"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import CharacterSheet from "@/components/CharacterSheet";
import Timeline from "@/components/Timeline";
import RelationshipsPanel from "@/components/RelationshipsPanel";
import Gallery from "@/components/Gallery";
import PromptBank from "@/components/PromptBank";
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

  const {
    worlds,
    createWorld,
    addFieldOption,
    optionsFor,
  } = useWorldCatalog();
  const { getWorldByName } = useWorlds();

  const [tab, setTab] = useState<
    "sheet" | "timeline" | "relations" | "gallery"
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={worldMeta?.color} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <Link href={backHref} className="text-neutral-500 hover:text-white text-sm">
              {backLabel}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const data = exportSingleCharacter(character);
                downloadExport(`${character.name || "character"}.json`, data);
              }}
              className="px-3 py-1.5 text-xs text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-800"
            >
              导出角色卡
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-xs text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-800"
            >
              导入角色卡
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const imported = importCharacterPayload(text);
                  const src = imported[0];
                  if (!src) {
                    alert("无效的角色卡文件");
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
                    world: character.world || src.world || "",
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
                  });
                } catch {
                  alert("导入失败");
                }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={async () => {
                if (!confirm("删除此角色卡？")) return;
                await deleteCharacter(id);
                window.location.href = backHref;
              }}
              className="px-3 py-1.5 text-xs text-rose-400 border border-rose-900/50 rounded-lg hover:bg-rose-950/30 transition"
            >
              删除
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-neutral-800 overflow-x-auto">
          {(
            [
              ["sheet", "角色卡"],
              ["gallery", "图库"],
              ["timeline", "时间线"],
              ["relations", "关系"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition border-b-2 -mb-px whitespace-nowrap ${
                tab === key
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "sheet" && (
          <CharacterSheet
            character={character}
            onChange={(updates) => updateCharacter(id, updates)}
            editable
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
            allCharacters={characters}
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
