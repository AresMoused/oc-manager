"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CharacterCard from "@/components/CharacterCard";
import WorldLorePanel from "@/components/WorldLorePanel";
import type { Character } from "@/lib/types";
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
  const loreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loreRef = useRef<WorldLore>(emptyLore());

  useEffect(() => {
    loreRef.current = lore;
  }, [lore]);

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

  const handleLoreChange = (next: WorldLore) => {
    if (!share?.canEdit) return;
    setLore(next);
    loreRef.current = next;
    if (loreTimer.current) clearTimeout(loreTimer.current);
    loreTimer.current = setTimeout(() => {
      persistLore(loreRef.current);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (loreTimer.current) clearTimeout(loreTimer.current);
    };
  }, []);

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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  角色卡
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {characters.length} 名
                  </span>
                </h2>
              </div>
              {characters.length === 0 ? (
                <p className="text-neutral-600 text-center py-10 border border-dashed border-neutral-800 rounded-xl text-sm">
                  此世界暂无角色
                </p>
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
    </div>
  );
}
