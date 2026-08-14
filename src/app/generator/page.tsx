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
  BuilderItem,
  BuilderSection,
  composePrompt,
  createPresetFromData,
  getActivePreset,
  getActivePresetId,
  getSyncUrl,
  listBuilderPresets,
  loadCachedBuilder,
  normalizeBuilderData,
  saveCachedBuilder,
  setActivePresetId,
  setSyncUrl,
  StoredBuilderPreset,
  syncBuilderFromGitHub,
  upsertBuilderPreset,
} from "@/lib/promptBuilder";
import GeneratorPresetsBar from "@/components/GeneratorPresetsBar";
import { StoredPrompt } from "@/lib/types";
import {
  CatalogToolbar,
  ItemEditorModal,
  SectionEditorModal,
} from "@/components/GeneratorCatalogControls";

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
  const [editMode, setEditMode] = useState(false);
  const [presets, setPresets] = useState<StoredBuilderPreset[]>([]);
  const [activePresetId, setActivePresetIdState] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("new");
  const [targetWorldId, setTargetWorldId] = useState("");
  const [targetCharId, setTargetCharId] = useState("");
  const [newCharName, setNewCharName] = useState("");

  const [sectionEditor, setSectionEditor] = useState<{
    key: string | null;
    sectionKey: string;
    label: string;
    icon: string;
    desc: string;
  } | null>(null);

  const [itemEditor, setItemEditor] = useState<{
    sectionKey: string;
    index: number | null;
    name: string;
    tags: string;
    hex: string;
  } | null>(null);

  const persist = useCallback((next: BuilderData) => {
    setData(next);
    saveCachedBuilder(next);
  }, []);

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
        source = { id: "empty", name: "空词库", fixed: "1girl, ", sections: [] };
      } else if (!listBuilderPresets().length) {
        createPresetFromData(source.name || "默认词库", source);
      }
      const list = listBuilderPresets();
      setPresets(list);
      const active = getActivePreset();
      setActivePresetIdState(active?.id || getActivePresetId() || "");
      if (active) source = active.data;
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

  const saveCurrentAsPreset = () => {
    const name = window.prompt("预设名称", data.name || "我的词库");
    if (!name || !name.trim()) return;
    if (!data.sections.length) {
      showToast("词库为空，无法保存");
      return;
    }
    const preset = createPresetFromData(name.trim(), { ...data, name: name.trim() });
    setPresets(listBuilderPresets());
    setActivePresetIdState(preset.id);
    showToast(`已保存预设：${preset.name}`);
  };

  const saveCurrentPresetOverwrite = () => {
    if (!activePresetId) {
      saveCurrentAsPreset();
      return;
    }
    const cur = listBuilderPresets().find((p) => p.id === activePresetId);
    if (!cur) {
      saveCurrentAsPreset();
      return;
    }
    upsertBuilderPreset({
      ...cur,
      data: { ...data, name: cur.name },
      name: cur.name,
    });
    setActivePresetId(cur.id);
    saveCachedBuilder({ ...data, name: cur.name });
    setPresets(listBuilderPresets());
    showToast(`已更新预设：${cur.name}`);
  };

  const toggleItem = (key: string, idx: number) => {
    if (editMode) return;
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
      const initSel: Record<string, number> = {};
      next.sections.forEach((s) => {
        initSel[s.key] = 0;
      });
      setSelected(initSel);
      setPresets(listBuilderPresets());
      setSyncMsg(`已同步 · ${next.sections.length} 分区 · ${source.split("/").pop()}`);
      showToast("同步成功");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "同步失败";
      setSyncMsg(msg);
      showToast(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.id || "prompt-catalog"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("已导出 JSON");
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const next = normalizeBuilderData(JSON.parse(text));
      persist(next);
      createPresetFromData(next.name || file.name.replace(/\.json$/i, ""), next);
      setPresets(listBuilderPresets());
      showToast("已导入提示词库");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导入失败");
    }
  };

  const openAddSection = () => {
    setSectionEditor({
      key: null,
      sectionKey: "section_" + Date.now().toString(36),
      label: "新分区",
      icon: "New",
      desc: "",
    });
  };

  const openEditSection = (s: BuilderSection) => {
    setSectionEditor({
      key: s.key,
      sectionKey: s.key,
      label: s.label,
      icon: s.icon || "",
      desc: s.desc || "",
    });
  };

  const saveSectionEditor = () => {
    if (!sectionEditor) return;
    const key = sectionEditor.sectionKey.trim() || "section";
    if (sectionEditor.key === null) {
      if (data.sections.some((s) => s.key === key)) {
        showToast("分区 key 已存在");
        return;
      }
      const sec: BuilderSection = {
        key,
        label: sectionEditor.label.trim() || key,
        icon: sectionEditor.icon.trim() || undefined,
        desc: sectionEditor.desc.trim() || undefined,
        items: [],
      };
      persist({ ...data, sections: [...data.sections, sec] });
      setSelected((p) => ({ ...p, [key]: -1 }));
    } else {
      const oldKey = sectionEditor.key;
      persist({
        ...data,
        sections: data.sections.map((s) =>
          s.key === oldKey
            ? {
                ...s,
                key,
                label: sectionEditor.label.trim() || key,
                icon: sectionEditor.icon.trim() || undefined,
                desc: sectionEditor.desc.trim() || undefined,
              }
            : s
        ),
      });
      if (oldKey !== key) {
        setSelected((p) => {
          const n = { ...p };
          n[key] = n[oldKey] ?? -1;
          delete n[oldKey];
          return n;
        });
      }
    }
    setSectionEditor(null);
    showToast("分区已保存");
  };

  const deleteSection = (key: string) => {
    if (!confirm(`删除分区「${key}」及其所有提示词？`)) return;
    persist({ ...data, sections: data.sections.filter((s) => s.key !== key) });
    setSelected((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    showToast("分区已删除");
  };

  const openAddItem = (sectionKey: string) => {
    setItemEditor({ sectionKey, index: null, name: "", tags: "", hex: "" });
  };

  const openEditItem = (sectionKey: string, index: number, item: BuilderItem) => {
    setItemEditor({
      sectionKey,
      index,
      name: item.name,
      tags: item.tags,
      hex: item.hex || "",
    });
  };

  const saveItemEditor = () => {
    if (!itemEditor) return;
    const name = itemEditor.name.trim();
    if (!name) {
      showToast("请填写名称");
      return;
    }
    let tags = itemEditor.tags.trim();
    if (tags && !tags.endsWith(", ") && !tags.endsWith(",")) tags = tags + ", ";
    const item: BuilderItem = {
      name,
      tags,
      hex: itemEditor.hex.trim() || undefined,
    };
    persist({
      ...data,
      sections: data.sections.map((s) => {
        if (s.key !== itemEditor.sectionKey) return s;
        const items = [...s.items];
        if (itemEditor.index === null) items.push(item);
        else items[itemEditor.index] = item;
        return { ...s, items };
      }),
    });
    setItemEditor(null);
    showToast("词条已保存");
  };

  const deleteItem = (sectionKey: string, index: number) => {
    if (!confirm("删除此词条？")) return;
    persist({
      ...data,
      sections: data.sections.map((s) => {
        if (s.key !== sectionKey) return s;
        return { ...s, items: s.items.filter((_, i) => i !== index) };
      }),
    });
    showToast("词条已删除");
  };

  const worldChars = characters.filter((c) => {
    const w = worlds.find((x) => x.id === targetWorldId);
    return w && c.world?.trim() === w.name;
  });

  const doImport = () => {
    if (!prompt.trim()) {
      showToast("提示词为空");
      return;
    }
    const stored: StoredPrompt = {
      id: crypto.randomUUID(),
      text: prompt,
      createdAt: new Date().toISOString(),
    };
    if (importMode === "new") {
      const w = worlds.find((x) => x.id === targetWorldId);
      if (!w) {
        showToast("请选择世界");
        return;
      }
      const name = newCharName.trim() || "Generated OC";
      const id = addCharacter(name, w.name);
      updateCharacter(id, {
        prompts: [stored],
        tags: prompt
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20),
      } as never);
      showToast("已创建角色");
      setImportOpen(false);
      router.push(`/character/${id}`);
    } else {
      if (!targetCharId) {
        showToast("请选择角色");
        return;
      }
      const ch = characters.find((c) => c.id === targetCharId);
      if (!ch) return;
      updateCharacter(targetCharId, {
        prompts: [...(ch.prompts || []), stored],
      } as never);
      showToast("已导入到角色");
      setImportOpen(false);
    }
  };

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
              <button onClick={copyPrompt} className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white">复制</button>
              <button onClick={() => setImportOpen(true)} className="px-3 py-1.5 text-sm rounded-lg border border-purple-700 text-purple-300 hover:bg-purple-950/40">导入角色卡</button>
              <button onClick={randomize} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">随机</button>
              <button onClick={reset} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">重置</button>
              <button onClick={clearAll} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">清除</button>
              <button onClick={lockAll} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                {data.sections.every((s) => locked[s.key]) ? "全部解锁" : "全部锁定"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-neutral-500 hover:text-white text-sm">← Worlds</Link>
            <h1 className="text-2xl font-bold text-white mt-1">角色外观生成器</h1>
            <p className="text-neutral-500 text-sm mt-1">组合外观标签；可编辑词库并保存为预设。</p>
          </div>
          <CatalogToolbar
            editMode={editMode}
            onToggleEdit={() => setEditMode((v) => !v)}
            onExport={handleExport}
            onImportFile={handleImportFile}
            onAddSection={openAddSection}
          />
        </div>

        <GeneratorPresetsBar
          presets={presets}
          activePresetId={activePresetId}
          toast={showToast}
          onSaveCurrent={saveCurrentAsPreset}
          onOverwriteCurrent={saveCurrentPresetOverwrite}
          onPresetsChange={(list, id, d) => {
            setPresets(list);
            setActivePresetIdState(id);
            setData(d);
            const initSel: Record<string, number> = {};
            const initLock: Record<string, boolean> = {};
            d.sections.forEach((s) => {
              initSel[s.key] = 0;
              initLock[s.key] =
                typeof window !== "undefined" &&
                localStorage.getItem("oc-gen-lock-" + s.key) === "1";
            });
            setSelected(initSel);
            setLocked(initLock);
          }}
        />

        <div className="bg-[#111] border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-200">同步当前预设 (GitHub)</h2>
            <button onClick={handleSync} disabled={syncing} className="px-3 py-1.5 text-sm rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white">
              {syncing ? "同步中…" : "Sync"}
            </button>
          </div>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500 text-neutral-300"
            value={syncUrl}
            onChange={(e) => setSyncUrlState(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../prompts.json"
          />
          {syncMsg && <p className="text-xs text-neutral-500 break-all">{syncMsg}</p>}
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-[11px] text-neutral-500">固定前缀 fixed:</label>
            <input
              className="flex-1 min-w-[120px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono outline-none focus:border-purple-500"
              value={data.fixed || ""}
              onChange={(e) => persist({ ...data, fixed: e.target.value })}
              placeholder="1girl, "
            />
          </div>
        </div>

        {editMode && (
          <p className="text-xs text-amber-400/90 px-1">
            编辑模式：可增删改分区与提示词；改完后请点「保存到当前预设」或「另存为新预设」。
          </p>
        )}

        {data.sections.length === 0 ? (
          <p className="text-center text-neutral-500 py-12 text-sm">暂无分区 · 请加载预设、Sync，或进入编辑模式添加</p>
        ) : (
          <div className="space-y-4">
            {data.sections.map((section) => (
              <div key={section.key} className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {section.icon ? `${section.icon} ` : ""}{section.label}
                    </h3>
                    {section.desc && <p className="text-[11px] text-neutral-500 truncate">{section.desc}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editMode ? (
                      <>
                        <button type="button" onClick={() => openEditSection(section)} className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300">编辑分区</button>
                        <button type="button" onClick={() => deleteSection(section.key)} className="text-[11px] px-2 py-0.5 rounded border border-rose-900/50 text-rose-400">删除</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleLock(section.key)}
                        className={`text-[11px] px-2 py-0.5 rounded border ${
                          locked[section.key]
                            ? "border-amber-600 text-amber-300"
                            : "border-neutral-700 text-neutral-400"
                        }`}
                      >
                        {locked[section.key] ? "已锁定" : "锁定"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {section.items.map((item, idx) => {
                    const active = selected[section.key] === idx;
                    return (
                      <div key={idx} className="relative group">
                        <button
                          type="button"
                          onClick={() => toggleItem(section.key, idx)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                            active && !editMode
                              ? "border-purple-500 bg-purple-950/40 text-purple-200"
                              : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                          }`}
                        >
                          {item.hex && (
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: item.hex }} />
                          )}
                          {item.name}
                        </button>
                        {editMode && (
                          <div className="absolute -top-2 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100">
                            <button type="button" onClick={() => openEditItem(section.key, idx, item)} className="w-5 h-5 text-[10px] rounded bg-neutral-800 border border-neutral-600 text-neutral-300">✎</button>
                            <button type="button" onClick={() => deleteItem(section.key, idx)} className="w-5 h-5 text-[10px] rounded bg-neutral-800 border border-rose-800 text-rose-400">×</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {editMode && (
                    <button type="button" onClick={() => openAddItem(section.key)} className="px-2.5 py-1 text-xs rounded-lg border border-dashed border-amber-700/60 text-amber-400/90">
                      + 词条
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {itemEditor && (
        <ItemEditorModal editor={itemEditor} onChange={setItemEditor} onClose={() => setItemEditor(null)} onSave={saveItemEditor} />
      )}
      {sectionEditor && (
        <SectionEditorModal editor={sectionEditor} onChange={setSectionEditor} onClose={() => setSectionEditor(null)} onSave={saveSectionEditor} />
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">导入角色卡</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setImportMode("new")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${importMode === "new" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>新建角色</button>
              <button type="button" onClick={() => setImportMode("existing")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${importMode === "existing" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>导入已有角色</button>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">世界</label>
              <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={targetWorldId} onChange={(e) => { setTargetWorldId(e.target.value); setTargetCharId(""); }}>
                {worlds.length === 0 && <option value="">（请先创建世界）</option>}
                {worlds.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            {importMode === "new" ? (
              <div>
                <label className="text-xs text-neutral-500 block mb-1">角色名</label>
                <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="Generated OC" />
              </div>
            ) : (
              <div>
                <label className="text-xs text-neutral-500 block mb-1">选择角色</label>
                <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={targetCharId} onChange={(e) => setTargetCharId(e.target.value)}>
                  <option value="">—</option>
                  {worldChars.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button onClick={doImport} disabled={!charsLoaded || (importMode === "existing" && !targetCharId)} className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white">确认导入</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-white text-black text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}
