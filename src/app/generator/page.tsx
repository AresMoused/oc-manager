"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import {
  BuilderData,
  composePrompt,
  getSyncUrl,
  loadCachedBuilder,
  setSyncUrl,
  syncBuilderFromGitHub,
  normalizeBuilderData,
  saveCachedBuilder,
} from "@/lib/promptBuilder";
import { StoredPrompt } from "@/lib/types";

const DEFAULT_SYNC =
  "https://raw.githubusercontent.com/AresMoused/oc-manager/main/public/prompts/original_character.json";

type ImportMode = "new" | "existing";

export default function GeneratorPage() {
  const router = useRouter();
  const { worlds, loaded: worldsLoaded } = useWorlds();
  const { characters, addCharacter, updateCharacter, loaded: charsLoaded } =
    useCharacters();

  const [data, setData] = useState<BuilderData>({ id: "loading", sections: [] });
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [syncUrl, setSyncUrlState] = useState(DEFAULT_SYNC);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [toast, setToast] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("new");
  const [targetWorldId, setTargetWorldId] = useState("");
  const [targetCharId, setTargetCharId] = useState("");
  const [newCharName, setNewCharName] = useState("");

  useEffect(() => {
    setSyncUrlState(getSyncUrl());
    async function boot() {
      let source = loadCachedBuilder();
      if (!source) {
        try {
          const res = await fetch("/prompts/original_character.json", {
            cache: "force-cache",
          });
          if (res.ok) {
            source = normalizeBuilderData(await res.json());
            saveCachedBuilder(source);
          }
        } catch {
          /* ignore */
        }
      }
      if (!source) {
        source = { id: "empty", fixed: "1girl, ", sections: [] };
      }
      setData(source);
      const initSel: Record<string, number> = {};
      const initLock: Record<string, boolean> = {};
      source.sections.forEach((s) => {
        initSel[s.key] = 0;
        initLock[s.key] =
          typeof window !== "undefined" &&
          localStorage.getItem("oc-gen-lock-" + s.key) === "1";
      });
      setSelected(initSel);
      setLocked(initLock);
    }
    boot();
  }, []);

  useEffect(() => {
    if (worldsLoaded && worlds.length && !targetWorldId) {
      setTargetWorldId(worlds[0].id);
    }
  }, [worldsLoaded, worlds, targetWorldId]);

  const prompt = useMemo(() => composePrompt(data, selected), [data, selected]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const toggleItem = (key: string, idx: number) => {
    setSelected((prev) => ({
      ...prev,
      [key]: prev[key] === idx ? -1 : idx,
    }));
  };

  const toggleLock = (key: string) => {
    setLocked((prev) => {
      const next = !prev[key];
      localStorage.setItem("oc-gen-lock-" + key, next ? "1" : "0");
      return { ...prev, [key]: next };
    });
  };

  const lockAll = () => {
    const allLocked = data.sections.every((s) => locked[s.key]);
    const state = !allLocked;
    const next: Record<string, boolean> = {};
    data.sections.forEach((s) => {
      next[s.key] = state;
      localStorage.setItem("oc-gen-lock-" + s.key, state ? "1" : "0");
    });
    setLocked(next);
  };

  const randomize = () => {
    setSelected((prev) => {
      const next = { ...prev };
      data.sections.forEach((s) => {
        if (!locked[s.key] && s.items.length > 0) {
          next[s.key] = Math.floor(Math.random() * s.items.length);
        }
      });
      return next;
    });
  };

  const reset = () => {
    const next: Record<string, number> = {};
    data.sections.forEach((s) => {
      next[s.key] = 0;
    });
    setSelected(next);
  };

  const clearAll = () => {
    const next: Record<string, number> = {};
    data.sections.forEach((s) => {
      next[s.key] = -1;
    });
    setSelected(next);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast("已复制");
    } catch {
      showToast("复制失败");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      setSyncUrl(syncUrl);
      const { data: next, source } = await syncBuilderFromGitHub(syncUrl);
      setData(next);
      setSelected((prev) => {
        const n: Record<string, number> = {};
        next.sections.forEach((s) => {
          n[s.key] = prev[s.key] ?? 0;
        });
        return n;
      });
      setSyncMsg(
        `已同步 · ${next.sections.length} 分区 · ${source.split("/").pop()}`
      );
      showToast("同步成功");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "同步失败";
      setSyncMsg(msg);
      showToast(msg);
    } finally {
      setSyncing(false);
    }
  };

  const worldChars = useMemo(() => {
    const w = worlds.find((x) => x.id === targetWorldId);
    if (!w) return characters;
    return characters.filter((c) => c.world?.trim() === w.name);
  }, [characters, worlds, targetWorldId]);

  const doImport = useCallback(() => {
    const text = prompt.trim();
    if (!text) {
      showToast("提示词为空");
      return;
    }
    const entry: StoredPrompt = {
      id: crypto.randomUUID(),
      text,
      label: "外观提示词",
      createdAt: new Date().toISOString(),
    };

    if (importMode === "new") {
      const w = worlds.find((x) => x.id === targetWorldId);
      const name = newCharName.trim() || "Generated OC";
      const id = addCharacter({
        name,
        world: w?.name || "",
        prompts: [entry],
      });
      setImportOpen(false);
      showToast("已创建角色卡");
      router.push(`/character/${id}`);
      return;
    }

    if (!targetCharId) {
      showToast("请选择角色");
      return;
    }
    const char = characters.find((c) => c.id === targetCharId);
    if (!char) {
      showToast("角色不存在");
      return;
    }
    updateCharacter(targetCharId, {
      prompts: [...(char.prompts || []), entry],
    });
    setImportOpen(false);
    showToast("已导入到角色");
    router.push(`/character/${targetCharId}`);
  }, [
    prompt,
    importMode,
    targetWorldId,
    targetCharId,
    newCharName,
    worlds,
    characters,
    addCharacter,
    updateCharacter,
    router,
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="sticky top-14 z-40 -mx-4 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur border-b border-neutral-800">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="flex-1 font-mono text-xs text-neutral-400 bg-[#111] border border-neutral-800 rounded-lg px-3 py-2 max-h-16 overflow-y-auto break-all">
              {prompt || "（未选择）"}
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <button
                onClick={copyPrompt}
                className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
              >
                复制
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="px-3 py-1.5 text-sm rounded-lg border border-purple-700 text-purple-300 hover:bg-purple-950/40"
              >
                导入角色卡
              </button>
              <button
                onClick={randomize}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                随机
              </button>
              <button
                onClick={reset}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                重置
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                清除
              </button>
              <button
                onClick={lockAll}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                {data.sections.every((s) => locked[s.key])
                  ? "全部解锁"
                  : "全部锁定"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="text-neutral-500 hover:text-white text-sm">
              ← Worlds
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white">原创角色生成器</h1>
          <p className="text-neutral-500 text-sm mt-1">
            组合发色、眼色、发型等，生成外观提示词，并可导入到世界角色卡。
          </p>
        </div>

        <div className="bg-[#111] border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-200">
              同步提示词库 (GitHub)
            </h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-sm rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white"
            >
              {syncing ? "同步中…" : "Sync"}
            </button>
          </div>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500 text-neutral-300"
            value={syncUrl}
            onChange={(e) => setSyncUrlState(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../prompts.json"
          />
          {syncMsg && (
            <p className="text-xs text-neutral-500 break-all">{syncMsg}</p>
          )}
          <p className="text-[11px] text-neutral-600">
            从 GitHub raw URL 拉取最新 JSON 提示词目录（结构见
            public/prompts/original_character.json）。
          </p>
        </div>

        <div className="space-y-3">
          {data.sections.map((section) => (
            <details
              key={section.key}
              className={`bg-[#111] border rounded-xl overflow-hidden ${
                locked[section.key]
                  ? "border-purple-700/60"
                  : "border-neutral-800"
              }`}
              open
            >
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-neutral-900/50">
                <span className="w-9 h-9 rounded-md bg-sky-800/80 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {section.icon || section.key.slice(0, 3)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-neutral-100 text-sm">
                    {section.label}
                  </div>
                  {section.desc && (
                    <div className="text-[11px] text-neutral-500 truncate">
                      {section.desc}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-purple-300 font-medium">
                    {selected[section.key] >= 0 &&
                    section.items[selected[section.key]]
                      ? section.items[selected[section.key]].name
                      : "—"}
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    {section.items.length} 项
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLock(section.key);
                  }}
                  className={`ml-2 px-2 py-0.5 text-[11px] rounded border shrink-0 ${
                    locked[section.key]
                      ? "border-purple-500 text-purple-300 bg-purple-950/40"
                      : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  {locked[section.key] ? "已锁定" : "锁定"}
                </button>
              </summary>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 px-4 pb-4">
                {section.items.map((item, idx) => {
                  const active = selected[section.key] === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleItem(section.key, idx)}
                      className={`relative text-left p-2.5 rounded-lg border transition ${
                        active
                          ? "border-purple-500 bg-purple-950/30 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]"
                          : "border-neutral-800 bg-[#0c0c0c] hover:border-neutral-600"
                      }`}
                    >
                      {item.hex ? (
                        <span
                          className="block w-7 h-7 rounded mb-1.5 border border-neutral-700"
                          style={{ background: item.hex }}
                        />
                      ) : null}
                      <span className="text-xs font-medium text-neutral-200 block">
                        {item.name}
                      </span>
                      {item.tags ? (
                        <span className="text-[10px] font-mono text-neutral-600 block mt-1 break-all leading-tight">
                          {item.tags}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </main>
      <Footer />

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">导入到角色卡</h2>
            <div className="font-mono text-[11px] text-neutral-400 bg-neutral-900 rounded-lg p-2 max-h-24 overflow-y-auto break-all">
              {prompt}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportMode("new")}
                className={`flex-1 py-2 text-sm rounded-lg border ${
                  importMode === "new"
                    ? "border-purple-500 text-purple-300 bg-purple-950/30"
                    : "border-neutral-700 text-neutral-400"
                }`}
              >
                新建角色
              </button>
              <button
                type="button"
                onClick={() => setImportMode("existing")}
                className={`flex-1 py-2 text-sm rounded-lg border ${
                  importMode === "existing"
                    ? "border-purple-500 text-purple-300 bg-purple-950/30"
                    : "border-neutral-700 text-neutral-400"
                }`}
              >
                导入已有角色
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-500 block mb-1">世界</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                value={targetWorldId}
                onChange={(e) => {
                  setTargetWorldId(e.target.value);
                  setTargetCharId("");
                }}
              >
                {worlds.length === 0 && (
                  <option value="">（请先创建世界）</option>
                )}
                {worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {importMode === "new" ? (
              <div>
                <label className="text-xs text-neutral-500 block mb-1">
                  角色名
                </label>
                <input
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Generated OC"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-neutral-500 block mb-1">
                  选择角色
                </label>
                <select
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  value={targetCharId}
                  onChange={(e) => setTargetCharId(e.target.value)}
                >
                  <option value="">—</option>
                  {worldChars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                onClick={doImport}
                disabled={
                  !charsLoaded || (importMode === "existing" && !targetCharId)
                }
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-white text-black text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
