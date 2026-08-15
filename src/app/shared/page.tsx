"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface ShareItem {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  permission: "readonly" | "editors";
  editorIds: string[];
  sharedAt: string;
  isOwner: boolean;
  canEdit: boolean;
}

export default function SharedZonePage() {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/shares")
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "请先登录" : "加载失败");
        return r.json();
      })
      .then((d) => setShares(d.shares || []))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <Link href="/" className="text-neutral-500 hover:text-white text-sm">
            ← Worlds
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">分享区</h1>
          <p className="text-neutral-500 text-sm mt-1">
            其他用户分享的世界。唯读或获授权后可修改。
          </p>
        </div>

        {loading && (
          <p className="text-neutral-500 text-sm text-center py-12">加载中…</p>
        )}
        {error && (
          <p className="text-rose-400 text-sm text-center py-12">{error}</p>
        )}
        {!loading && !error && shares.length === 0 && (
          <p className="text-neutral-600 text-sm text-center py-12 border border-dashed border-neutral-800 rounded-xl">
            暂无分享 · 在「世界」页面可将自己的世界分享到这里
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shares.map((s) => (
            <Link
              key={s.id}
              href={`/shared/${s.id}`}
              className="block bg-[#111] border border-neutral-800 hover:border-neutral-600 rounded-xl p-4 transition group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: s.worldColor }}
                />
                <h2 className="text-white font-semibold truncate group-hover:text-purple-200">
                  {s.worldName}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.ownerAvatarUrl}
                  alt=""
                  className="w-5 h-5 rounded-full ring-1 ring-neutral-700"
                />
                <span className="truncate">{s.ownerName}</span>
                {s.isOwner && (
                  <span className="text-purple-400 shrink-0">你的分享</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    s.canEdit
                      ? "border-emerald-800 text-emerald-300"
                      : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  {s.canEdit ? "可修改" : "唯读"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-800 text-neutral-600">
                  {s.permission === "editors" ? "指定编辑者" : "全员唯读"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
