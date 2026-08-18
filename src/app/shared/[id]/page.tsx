"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CharacterCard from "@/components/CharacterCard";
import WorldLorePanel from "@/components/WorldLorePanel";
import type { Character } from "@/lib/types";
import { defaultCharacter } from "@/lib/types";
import { createId } from "@/lib/storage";
import { emptyLore, type WorldLore } from "@/lib/worldLore";

interface ShareMeta {
  id: string;
  ownerName: string;
  ownerAvatarUrl: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  permission: string;
  canEdit: boolean;
  isOwner: boolean;
}

export default function SharedWorldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lore, setLore] = useState<WorldLore>(emptyLore());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);
  const loreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loreRef = useRef<WorldLore>(emptyLore());
  const charsRef = useRef<Character[]>([]);

  useEffect(() => {
    loreRef.current = lore;
  }, [lore]);

  useEffect(() => {
    charsRef.current = characters;
  }, [characters]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/shares/${id}/content`)
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "加载失败");
        }
        return r.json();
      })
      .then((d) => {
        setShare(d.share);
        setCharacters(d.characters || []);
        setLore(d.lore || emptyLore());
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const persistLore = useCallback(
    async (next: WorldLore) => {
      if (!share?.canEdit) return;
      setSaving(true);
      setSaveError("");
      try {
        const res = await fetch(`/api/shares/${id}/content`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lore: next }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || `保存失败 (${res.status})`);
        }
        const d = await res.json();
        if (d.lore) setLore(d.lore);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [id, share?.canEdit]
  );

  const persistCharacters = useCallback(
    async (nextList: Character[]) => {
      if (!share?.canEdit) return;
      setSaving(true);
      setSaveError("");
      try {
        const res = await fetch(`/api/shares/${id}/content`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: nextList }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || `保存失败 (${res.status})`);
        }
        const d = await res.json();
        if (Array.isArray(d.characters)) {
          setCharacters(d.characters);
          charsRef.current = d.characters;
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [id, share?.canEdit]
  );

  const handleLoreChange = (next: WorldLore) => {
    if (!share?.canEdit) return;
    setLore(next);
    loreRef.current = next;
    if (loreTimer.current) clearTimeout(loreTimer.current);
    loreTimer.current = setTimeout(() => {
      persistLore(loreRef.current);
    }, 600);
  };

  const handleCreate = async () => {
    if (!share?.canEdit || !newName.trim() || creatingBusy) return;
    const name = newName.trim();
    const now = new Date().toISOString();
    const newChar: Character = {
      id: createId(),
      ...defaultCharacter(),
      name,
      world: share.worldName,
      createdAt: now,
      updatedAt: now,
    };
    const nextList = [...charsRef.current, newChar];
    setCreatingBusy(true);
    setSaveError("");
    // Optimistic update
    setCharacters(nextList);
    charsRef.current = nextList;
    try {
      await persistCharacters(nextList);
      setCreating(false);
      setNewName("");
    } catch {
      // Revert optimistic add on failure
      const reverted = charsRef.current.filter((c) => c.id !== newChar.id);
      setCharacters(reverted);
      charsRef.current = reverted;
    } finally {
      setCreatingBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (loreTimer.current) clearTimeout(loreTimer.current);
    };
  }, []);

  const canEdit = !!share?.canEdit;
  const accent = share?.worldColor || "#a855f7";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={share?.worldColor} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-8">
        <div>
          <Link
            href="/shared"
            className="text-neutral-500 hover:text-white text-sm"
          >
            ← 分享区
          </Link>
          {share && (
            <>
              <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: share.worldColor }}
                />
                {share.worldName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-neutral-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={share.ownerAvatarUrl}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
                <span>{share.ownerName}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    share.canEdit
                      ? "border-emerald-800 text-emerald-300"
                      : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  {share.canEdit ? "可修改（协作）" : "唯读"}
                </span>
                {share.isOwner && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-800/60 text-purple-300">
                    你的分享
                  </span>
                )}
                {saving && (
                  <span className="text-[10px] text-neutral-500">保存中…</span>
                )}
                {saveError && (
                  <span className="text-[10px] text-rose-400">{saveError}</span>
                )}
              </div>
              <p className="text-xs text-neutral-600 mt-2">
                {share.canEdit
                  ? "你有编辑权限，可修改世界观设定与角色卡（写入主人数据）。"
                  : "唯读模式：可浏览角色卡与世界观，无法修改。"}
              </p>
            </>
          )}
        </div>

        {loading && (
          <p className="text-neutral-500 text-center py-12">加载中…</p>
        )}
        {error && (
          <p className="text-rose-400 text-center py-12">{error}</p>
        )}

        {!loading && !error && (
          <>
            {/* Characters */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">
                  角色卡
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {characters.length} 名
                  </span>
                </h2>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewName("");
                      setCreating(true);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg text-white font-medium transition flex items-center gap-1.5 shrink-0"
                    style={{ backgroundColor: accent }}
                  >
                    <span className="text-lg leading-none">+</span> 新建角色
                  </button>
                )}
              </div>
              {characters.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-neutral-800 rounded-xl">
                  <p className="text-neutral-600 text-sm mb-3">此世界暂无角色</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewName("");
                        setCreating(true);
                      }}
                      className="px-4 py-2 rounded-lg text-white text-sm"
                      style={{ backgroundColor: accent }}
                    >
                      + 新建角色
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {characters.map((c) => (
                    <CharacterCard
                      key={c.id}
                      character={c}
                      accentColor={share?.worldColor}
                      href={`/shared/${id}/character/${c.id}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* World lore */}
            {share && (
              <section>
                <WorldLorePanel
                  worldName={share.worldName}
                  lore={lore}
                  editable={!!share.canEdit}
                  characterNames={characters.map((c) => c.name).filter(Boolean)}
                  onChange={handleLoreChange}
                />
              </section>
            )}
          </>
        )}
      </main>
      <Footer />

      {creating && share && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">新建角色</h2>
            <div
              className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
              style={{
                backgroundColor: accent + "22",
                color: accent,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {share.worldName}
            </div>
            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 text-white"
              placeholder="角色姓名..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              disabled={creatingBusy}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                disabled={creatingBusy}
                className="px-4 py-2 text-sm text-neutral-400 disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newName.trim() || creatingBusy}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {creatingBusy ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
