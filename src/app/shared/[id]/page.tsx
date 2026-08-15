"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Character } from "@/lib/types";

interface ShareMeta {
  id: string;
  ownerName: string;
  ownerAvatarUrl: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
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
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: share.worldColor }}
                />
                {share.worldName}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
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
                  {share.canEdit ? "可修改" : "唯读"}
                </span>
              </div>
            </>
          )}
        </div>

        {loading && (
          <p className="text-neutral-500 text-center py-12">加载中…</p>
        )}
        {error && (
          <p className="text-rose-400 text-center py-12">{error}</p>
        )}
        {!loading && !error && characters.length === 0 && (
          <p className="text-neutral-600 text-center py-12">此世界暂无角色</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {characters.map((c) => (
            <div
              key={c.id}
              className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden"
            >
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="w-full aspect-[3/4] object-cover"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-neutral-900 flex items-center justify-center text-neutral-700 text-xs">
                  无图
                </div>
              )}
              <div className="p-2.5">
                <div className="text-sm text-white font-medium truncate">
                  {c.name}
                </div>
                {c.faction && (
                  <div className="text-[11px] text-neutral-500 truncate">
                    {c.faction}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {share?.canEdit && (
          <p className="text-xs text-neutral-600 text-center">
            你有编辑权限。完整在线编辑（写入主人数据）可在后续继续增强；当前可查看全部角色。
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
