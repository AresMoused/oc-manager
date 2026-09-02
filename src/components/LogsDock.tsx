"use client";

import { useEffect, useMemo, useState } from "react";
import { resetAllDockGeo, useDockGeo } from "@/hooks/useDockGeo";
import { clearDebugLogs, loadDebugLogs, type DebugLogEntry } from "@/lib/debugLog";

const SOURCES = ["全部", "陪玩姬", "角色对话", "抽卡姬", "AI生成角色"] as const;

export default function LogsDock() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState<(typeof SOURCES)[number]>("全部");
  const [openId, setOpenId] = useState<string | null>(null);
  const { panelRef, panelStyle, headerDrag, resizeHandle } = useDockGeo(
    "oc-logs-geo-v1",
    { w: 440, h: 520, fab: "start" }
  );

  useEffect(() => {
    if (!open) return;
    setTick((n) => n + 1);
    const id = window.setInterval(() => setTick((n) => n + 1), 2000);
    return () => window.clearInterval(id);
  }, [open]);

  const logs = useMemo(() => {
    void tick;
    return loadDebugLogs();
  }, [tick]);
  const shown = source === "全部" ? logs : logs.filter((l) => l.source === source);

  const copy = async (e: DebugLogEntry) => {
    await navigator.clipboard.writeText(JSON.stringify(e, null, 2));
  };

  return (
    <>
      <div className="fixed z-[82] left-3 bottom-3 flex items-center gap-1">
        {!open && (
          <button
            type="button"
            className="h-9 px-3 rounded-full bg-neutral-800/95 border border-neutral-600 text-neutral-200 text-xs shadow-lg hover:bg-neutral-700"
            title="请求日志"
            onClick={() => setOpen(true)}
          >
            日志{logs.length ? ` ${Math.min(logs.length, 99)}` : ""}
          </button>
        )}
        <button
          type="button"
          className="h-9 w-9 rounded-full bg-neutral-800/95 border border-neutral-600 text-neutral-200 text-sm shadow-lg hover:bg-neutral-700"
          title="重置所有悬浮窗和悬浮球位置"
          onClick={() => {
            resetAllDockGeo();
            setOpen(false);
          }}
        >
          ↺
        </button>
      </div>
      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="fixed z-[82] rounded-2xl border border-neutral-700 bg-[#121214]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2 cursor-grab active:cursor-grabbing"
            {...headerDrag}
          >
            <div className="text-sm text-white">请求日志</div>
            <span className="text-[10px] text-neutral-500">本机 · {shown.length}</span>
            <button
              type="button"
              className="ml-auto text-[11px] text-neutral-400 hover:text-white"
              onClick={() => setTick((n) => n + 1)}
            >
              刷新
            </button>
            <button
              type="button"
              className="text-[11px] text-neutral-400 hover:text-rose-300"
              onClick={() => {
                clearDebugLogs();
                setTick((n) => n + 1);
              }}
            >
              清空
            </button>
            <button type="button" className="text-neutral-400 w-7 h-7" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="px-2 py-1.5 flex gap-1 flex-wrap border-b border-neutral-800">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] border ${
                  source === s ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {shown.length === 0 ? (
              <p className="text-neutral-500 text-xs py-8 text-center">对话或出图后会出现在这里。</p>
            ) : (
              shown.map((e) => (
                <div key={e.id} className="border border-neutral-800 rounded-xl bg-[#111] overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 flex items-center gap-1.5"
                    onClick={() => setOpenId((id) => (id === e.id ? null : e.id))}
                  >
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded ${
                        e.kind === "error"
                          ? "bg-rose-950 text-rose-300"
                          : e.kind === "comfy"
                            ? "bg-sky-950 text-sky-300"
                            : e.kind === "tool"
                              ? "bg-amber-950 text-amber-200"
                              : "bg-fuchsia-950 text-fuchsia-200"
                      }`}
                    >
                      {e.kind}
                    </span>
                    <span className="text-[10px] text-neutral-500 w-14 shrink-0 truncate">{e.source}</span>
                    <span className="text-xs text-neutral-200 truncate flex-1">{e.title}</span>
                    <span className="text-[10px] text-neutral-600 font-mono shrink-0">
                      {e.at.replace("T", " ").slice(11, 19)}
                    </span>
                  </button>
                  {openId === e.id && (
                    <div className="px-2 pb-2 space-y-1">
                      <div className="flex justify-end">
                        <button type="button" className="text-[11px] text-purple-300" onClick={() => void copy(e)}>
                          复制 JSON
                        </button>
                      </div>
                      <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap break-all max-h-[360px] overflow-y-auto bg-black/40 rounded-lg p-2 font-mono">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div
            className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize z-10"
            {...resizeHandle}
            title="拖动放大"
          >
            <div className="absolute right-1 bottom-1 w-2 h-2 border-r-2 border-b-2 border-neutral-500" />
          </div>
        </div>
      )}
    </>
  );
}