"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import { CheckHost, FreeDiceButton } from "@/systems/check/CheckHost";
import DndBriefCard from "@/systems/dnd5e/DndBriefCard";
import SpellPresetPanel from "@/systems/dnd5e/SpellPresetPanel";
import type { Character } from "@/lib/types";

export default function WorldDmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getWorld, updateWorld, loaded: worldsLoaded } = useWorlds();
  const { characters, loaded: charsLoaded } = useCharacters();
  const world = getWorld(id);
  const loaded = worldsLoaded && charsLoaded;

  const worldChars = useMemo(() => {
    if (!world) return [];
    return characters.filter((c) => c.world?.trim() === world.name);
  }, [characters, world]);

  const roster = new Set(world?.dmRoster || []);
  const shown = worldChars.filter((c) => roster.has(c.id));
  const pcs = shown.filter((c) => c.sheetRole !== "npc");
  const npcs = shown.filter((c) => c.sheetRole === "npc");

  const toggle = (cid: string) => {
    if (!world) return;
    const next = roster.has(cid)
      ? (world.dmRoster || []).filter((x) => x !== cid)
      : [...(world.dmRoster || []), cid];
    updateWorld(world.id, { dmRoster: next });
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }
  if (!world) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <p className="p-8 text-neutral-400">World not found</p>
      </div>
    );
  }

  return (
    <CheckHost>
      <div className="min-h-screen flex flex-col">
        <Navbar worldColor={world.color} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/world/${world.id}`} className="text-sm text-neutral-500 hover:text-white">
                ← {world.name}
              </Link>
              <h1 className="text-2xl font-bold text-white mt-1">DM 页</h1>
            </div>
            <FreeDiceButton />
          </div>

          <section className="rounded-xl border border-neutral-800 bg-[#111] p-4">
            <h2 className="text-sm font-medium text-white mb-2">出现在本页的角色</h2>
            <div className="flex flex-wrap gap-2">
              {worldChars.length === 0 && (
                <p className="text-xs text-neutral-500">这个世界还没有角色</p>
              )}
              {worldChars.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={roster.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="text-neutral-200">{c.name || "未命名"}</span>
                  <span className="text-neutral-500">
                    {c.sheetRole === "npc" ? "NPC" : "玩家"}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <Row title="玩家" list={pcs} />
          <Row title="NPC" list={npcs} />

          {world.system === "dnd5e" && (
            <SpellPresetPanel
              presets={world.spellPresets || []}
              onChange={(spellPresets) => updateWorld(world.id, { spellPresets })}
              defaultCollapsed
            />
          )}
        </main>
        <Footer />
      </div>
    </CheckHost>
  );
}

function Row({
  title,
  list,
}: {
  title: string;
  list: Character[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-300">{title}</h2>
      {list.length === 0 ? (
        <p className="text-xs text-neutral-600">未选择</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {list.map((c) => (
            <DndBriefCard
              key={c.id}
              character={c}
              href={`/character/${c.id}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
