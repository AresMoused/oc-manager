"use client";

import { use, useRef, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CharacterCard from "@/components/CharacterCard";
import ShareWorldModal from "@/components/ShareWorldModal";
import WorldLorePanel from "@/components/WorldLorePanel";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import {
  exportByWorld,
  importCharacters,
  downloadExport,
  createId,
} from "@/lib/storage";
import { useAppData } from "@/context/AppDataContext";
import { getLore } from "@/lib/worldLore";
import type { LoreHistoryEvent } from "@/lib/worldLore";
import { WORLD_SYSTEMS, worldSystemLabel } from "@/lib/worlds";
import { defaultDndPlay, wrapPlay } from "@/systems/dnd5e/schema";
import { mergeCoreSpellPresets } from "@/systems/dnd5e/spellPresets";
import SpellPresetPanel from "@/systems/dnd5e/SpellPresetPanel";

export default function WorldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getWorld, updateWorld, loaded: worldsLoaded } = useWorlds();
  const {
    characters,
    loaded: charsLoaded,
    addCharacter,
    deleteCharacter,
    replaceAll,
  } = useCharacters();
  const { lore, setLore } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"pc" | "npc">("pc");
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const refreshShareStatus = useCallback(() => {
    if (!id) return;
    fetch("/api/shares")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.shares || [];
        setIsShared(
          list.some(
            (s: { worldId?: string; isOwner?: boolean }) =>
              s.worldId === id && s.isOwner
          )
        );
      })
      .catch(() => setIsShared(false));
  }, [id]);

  useEffect(() => {
    refreshShareStatus();
  }, [refreshShareStatus, shareOpen]);

  const world = getWorld(id);
  const loaded = worldsLoaded && charsLoaded;

  const worldChars = useMemo(() => {
    if (!world) return [];
    return characters.filter((c) => c.world?.trim() === world.name);
  }, [characters, world]);

  const handleCreate = async () => {
    if (!world || !newName.trim() || creatingBusy) return;
    setCreatingBusy(true);
    try {
      await addCharacter({
        name: newName.trim(),
        world: world.name,
        sheetRole: newRole,
        play: world.system === "dnd5e" ? wrapPlay(defaultDndPlay()) : undefined,
      });
      setCreating(false);
      setNewName("");
      setNewRole("pc");
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败，请重试");
    } finally {
      setCreatingBusy(false);
    }
  };

  const handleExportWorld = () => {
    if (!world) return;
    const data = exportByWorld(worldChars);
    downloadExport(
      `oc-world-${world.name}-${new Date().toISOString().slice(0, 10)}.json`,
      data
    );
  };

  const handleImportWorld = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !world) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const list = importCharacters(reader.result as string);
        if (!list.length) {
          alert("文件中没有角色卡");
          return;
        }
        const now = new Date().toISOString();
        const imported = list.map((c) => ({
          ...c,
          id: createId(),
          world: world.name,
          createdAt: c.createdAt || now,
          updatedAt: now,
        }));
        if (
          !confirm(
            `将导入 ${imported.length} 张角色卡到世界「${world.name}」？\n（会替换本世界现有角色，其他世界不受影响）`
          )
        ) {
          return;
        }
        const others = characters.filter(
          (c) => c.world?.trim() !== world.name
        );
        await replaceAll([...others, ...imported]);
        alert(`已导入 ${imported.length} 张角色卡到「${world.name}」`);
      } catch {
        alert("导入失败：无效 JSON");
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

  const worldLore = getLore(lore || {}, world.name);

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
              {worldSystemLabel(world.system)}
            </span>
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
              {worldChars.length} characters
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300"
              value={world.system || "generic"}
              onChange={(e) => {
                const system = e.target.value as typeof world.system;
                updateWorld(world.id, {
                  system,
                  ...(system === "dnd5e"
                    ? {
                        spellPresets: mergeCoreSpellPresets(
                          world.spellPresets || []
                        ),
                      }
                    : {}),
                });
              }}
            >
              {WORLD_SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Link
              href={`/world/${id}/dm`}
              className="px-3 py-1.5 text-sm rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-medium"
            >
              DM
            </Link>
            <Link
              href={`/world/${id}/relationships`}
              className="px-3 py-1.5 text-sm border rounded-lg transition"
              style={{ borderColor: world.color + "66", color: world.color }}
            >
              Relationship Map
            </Link>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className={`px-3 py-1.5 text-sm border rounded-lg transition ${
                isShared
                  ? "border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/40"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              }`}
              title="分享到分享区 / 设置权限"
            >
              {isShared ? "已分享 · 管理" : "分享"}
            </button>
            <button
              onClick={handleExportWorld}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
              title="导出此世界全部角色"
            >
              输出整个世界
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition"
              title="导入整个世界的角色卡"
            >
              输入整个世界
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportWorld}
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

        {/* World lore panels */}
        <div className="mt-10" id="world-lore">
          {world.system === "dnd5e" && (
            <div className="mb-8">
              <SpellPresetPanel
                presets={world.spellPresets || []}
                onChange={(spellPresets) =>
                  updateWorld(world.id, { spellPresets })
                }
                defaultCollapsed
              />
            </div>
          )}
          <WorldLorePanel
            worldName={world.name}
            lore={worldLore}
            editable
            characterNames={worldChars.map((c) => c.name).filter(Boolean)}
            onChange={(next) => {
              setLore((prev) => ({
                ...prev,
                [world.name]: next,
              }));
            }}
            onSyncHistoryToTimelines={
              (_events: LoreHistoryEvent[], _previous: LoreHistoryEvent[]) => {
                /* history → character timeline sync can be extended later */
              }
            }
          />
        </div>
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
            <div className="flex gap-3 text-sm text-neutral-300">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={newRole === "pc"}
                  onChange={() => setNewRole("pc")}
                />
                玩家
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={newRole === "npc"}
                  onChange={() => setNewRole("npc")}
                />
                NPC
              </label>
            </div>
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
                disabled={!newName.trim() || creatingBusy}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-40"
                style={{ backgroundColor: world.color }}
              >
                {creatingBusy ? "保存中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareWorldModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        worldId={world.id}
        worldName={world.name}
        worldColor={world.color}
        onChanged={refreshShareStatus}
      />
    </div>
  );
}
