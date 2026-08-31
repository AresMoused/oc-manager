"use client";

import { useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { clearDebugLogs, loadDebugLogs, type DebugLogEntry } from "@/lib/debugLog";

const SOURCES = ["全部", "陪玩姬", "角色对话", "抽卡姬", "AI生成角色"] as const;

export default function LogsView() {
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState<(typeof SOURCES)[number]>("全部");
  const [openId, setOpenId] = useState<string | null>(null);
  const logs = useMemo(() => {
    void tick;
    return loadDebugLogs();
  }, [tick]);
  const shown = source === "全部" ? logs : logs.filter((l) => l.source === source);

  const copy = async (e: DebugLogEntry) => {
    await navigator.clipboard.writeText(JSON.stringify(e, null, 2));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-white">请求日志</h1>
          <span className="text-xs text-neutral-500">保存在本机，不含 API Key</span>
          <button
            type="button"
            className="ml-auto text-xs px-3 py-1 rounded border border-neutral-700 text-neutral-300"
            onClick={() => { clearDebugLogs(); setTick((n) => n + 1); }}
          >
            清空
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-neutral-700 text-neutral-300"
            onClick={() => setTick((n) => n + 1)}
          >
            刷新
          </button>
        </div>
        <div className="flex gap-2 flex-wrap text-[11px]">
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`px-3 py-1 rounded-full border ${source === s ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-500"}`}
            >
              {s}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="text-neutral-500 text-sm py-12 text-center">还没有日志。对话或出图之后会出现在这里。</p>
        ) : (
          <div className="space-y-2">
            {shown.map((e) => (
              <div key={e.id} className="border border-neutral-800 rounded-xl bg-[#111] overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 flex items-center gap-2"
                  onClick={() => setOpenId((id) => (id === e.id ? null : e.id))}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    e.kind === "error" ? "bg-rose-950 text-rose-300" :
                    e.kind === "comfy" ? "bg-sky-950 text-sky-300" :
                    e.kind === "tool" ? "bg-amber-950 text-amber-200" :
                    "bg-fuchsia-950 text-fuchsia-200"
                  }`}>{e.kind}</span>
                  <span className="text-[11px] text-neutral-500 w-16 shrink-0">{e.source}</span>
                  <span className="text-sm text-neutral-200 truncate flex-1">{e.title}</span>
                  <span className="text-[10px] text-neutral-600 font-mono">{e.at.replace("T", " ").slice(0, 19)}</span>
                </button>
                {openId === e.id && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex justify-end">
                      <button type="button" className="text-[11px] text-purple-300" onClick={() => void copy(e)}>复制 JSON</button>
                    </div>
                    <pre className="text-[11px] text-neutral-400 whitespace-pre-wrap break-all max-h-[480px] overflow-y-auto bg-black/40 rounded-lg p-2 font-mono">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}