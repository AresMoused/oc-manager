"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Temporary stub — full UI will be restored in next commit */
export default function ComfyView() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 space-y-4">
        <Link href="/" className="text-neutral-500 text-sm">
          ← Worlds
        </Link>
        <h1 className="text-2xl font-bold text-white">抽卡姬</h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          抽卡姬页面正在从备份恢复中。请先使用
          <Link href="/generator" className="text-purple-400 mx-1 underline">
            角色外观生成器
          </Link>
          （CDN 词库已可用）。完整抽卡姬 UI 将在下一提交恢复。
        </p>
      </main>
      <Footer />
    </div>
  );
}
