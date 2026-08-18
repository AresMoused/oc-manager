"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  listBuilderPresets,
  loadCachedBuilder,
  normalizeBuilderData,
  saveCachedBuilder,
  setActivePresetId,
  StoredBuilderPreset,
  upsertBuilderPreset,
} from "@/lib/promptBuilder";
import GeneratorPresetsBar from "@/components/GeneratorPresetsBar";
import { loadParams, saveParams } from "@/lib/comfyConfig";
import { StoredPrompt } from "@/lib/types";
import {
  CatalogToolbar,
  SectionEditorModal,
} from "@/components/GeneratorCatalogControls";
import { uploadImage } from "@/lib/apiClient";

type ImportMode = "new" | "existing";

/** Compress image to 128×128 cover-crop webp for lexicon previews */
async function compressToPreviewWebp(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("WebP encode failed"));
            return;
          }
          resolve(new File([blob], "preview.webp", { type: "image/webp" }));
        },
        "image/webp",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function GeneratorPage() {
  const router = useRouter();
  const { worlds, loaded: worldsLoaded } = useWorlds();
  const { characters, addCharacter, updateCharacter, loaded: charsLoaded } =
    useCharacters();

  const [data, setData] = useState<BuilderData>({ id: "loading", sections: [] });
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [sectionEnabled, setSectionEnabled] = useState<Record<string, boolean>>({});
  const [sectionPanelOpen, setSectionPanelOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [presets, setPresets] = useState<StoredBuilderPreset[]>([]);
  const [activePresetId, setActivePresetIdState] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

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

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const persist = useCallback((next: BuilderData) => {
    setData(next);
    saveCachedBuilder(next);
  }, []);

  useEffect(() => {
    async function boot() {
      let source = loadCachedBuilder();
      if (!source) {
        try {
          const res = await fetch("/prompts/original_character.json", { cache: "force-cache" });
          if (res.ok) {
            source = normalizeBuilderData(await res.json());
            saveCachedBuilder(source);
          }
        } catch { /* ignore */ }
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
      const en: Record<string, boolean> = {};
      source.sections.forEach((s) => {
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem("oc-gen-sec-on-" + s.key)
            : null;
        en[s.key] = saved === null ? true : saved === "1";
      });
      setSectionEnabled(en);
    }
    boot();
  }, []);

  useEffect(() => {
    if (worldsLoaded && worlds.length && !targetWorldId) setTargetWorldId(worlds[0].id);
  }, [worldsLoaded, worlds, targetWorldId]);

  const activeData = useMemo(
    () => ({
      ...data,
      sections: data.sections.filter((s) => sectionEnabled[s.key] !== false),
    }),
    [data, sectionEnabled]
  );

  const prompt = useMemo(
    () => composePrompt(activeData, selected),
    [activeData, selected]
  );

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
    upsertBuilderPreset({ ...cur, data: { ...data, name: cur.name }, name: cur.name });
    setActivePresetId(cur.id);
    saveCachedBuilder({ ...data, name: cur.name });
    setPresets(listBuilderPresets());
    showToast(`已更新预设：${cur.name}`);
  };

  const toggleItem = (key: string, idx: number) => {
    if (editMode) return;
    setSelected((prev) => ({ ...prev, [key]: prev[key] === idx ? -1 : idx }));
  };

  const toggleLock = (key: string) => {
    setLocked((prev) => {
      const next = !prev[key];
      localStorage.setItem("oc-gen-lock-" + key, next ? "1" : "0");
      return { ...prev, [key]: next };
    });
  };

  const toggleSectionEnabled = (key: string) => {
    setSectionEnabled((prev) => {
      const next = !(prev[key] !== false);
      localStorage.setItem("oc-gen-sec-on-" + key, next ? "1" : "0");
      return { ...prev, [key]: next };
    });
  };

  const setAllSectionsEnabled = (on: boolean) => {
    const next: Record<string, boolean> = {};
    data.sections.forEach((s) => {
      next[s.key] = on;
      localStorage.setItem("oc-gen-sec-on-" + s.key, on ? "1" : "0");
    });
    setSectionEnabled(next);
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
        if (sectionEnabled[s.key] === false) return;
        if (!locked[s.key] && s.items.length > 0) {
          next[s.key] = Math.floor(Math.random() * s.items.length);
        }
      });
      return next;
    });
  };

  const reset = () => {
    const next: Record<string, number> = {};
    data.sections.forEach((s) => { next[s.key] = 0; });
    setSelected(next);
  };

  const clearAll = () => {
    const next: Record<string, number> = {};
    data.sections.forEach((s) => { next[s.key] = -1; });
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

  const sendPromptToComfy = () => {
    if (!prompt.trim()) {
      showToast("提示词为空");
      return;
    }
    try {
      const cur = loadParams();
      saveParams({ ...cur, prompt_character: prompt.trim() });
      showToast("已导入到抽卡姬「角色提示词」");
    } catch {
      showToast("写入抽卡姬失败");
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
    setSectionEditor({ key: null, sectionKey: "section_" + Date.now().toString(36), label: "新分区", icon: "New", desc: "" });
  };

  const openEditSection = (s: BuilderSection) => {
    setSectionEditor({ key: s.key, sectionKey: s.key, label: s.label, icon: s.icon || "", desc: s.desc || "" });
  };

  const saveSectionEditor = () => {
    if (!sectionEditor) return;
    const key = sectionEditor.sectionKey.trim() || "section";
    if (sectionEditor.key === null) {
      if (data.sections.some((s) => s.key === key)) {
        showToast("分区 key 已存在");
        return;
      }
      persist({
        ...data,
        sections: [...data.sections, {
          key, label: sectionEditor.label.trim() || key,
          icon: sectionEditor.icon.trim() || undefined,
          desc: sectionEditor.desc.trim() || undefined, items: [],
        }],
      });
      setSelected((p) => ({ ...p, [key]: -1 }));
      setSectionEnabled((p) => ({ ...p, [key]: true }));
    } else {
      const oldKey = sectionEditor.key;
      persist({
        ...data,
        sections: data.sections.map((s) =>
          s.key === oldKey
            ? { ...s, key, label: sectionEditor.label.trim() || key, icon: sectionEditor.icon.trim() || undefined, desc: sectionEditor.desc.trim() || undefined }
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
    setSelected((p) => { const n = { ...p }; delete n[key]; return n; });
    showToast("分区已删除");
  };

  const updateItemField = (
    sectionKey: string,
    index: number,
    patch: Partial<BuilderItem>
  ) => {
    persist({
      ...data,
      sections: data.sections.map((s) => {
        if (s.key !== sectionKey) return s;
        const items = s.items.map((it, i) =>
          i === index ? { ...it, ...patch } : it
        );
        return { ...s, items };
      }),
    });
  };

  const addItemInline = (sectionKey: string) => {
    persist({
      ...data,
      sections: data.sections.map((s) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          items: [...s.items, { name: "", tags: "", image: undefined }],
        };
      }),
    });
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

  const handlePreviewUpload = async (
    sectionKey: string,
    index: number,
    file: File
  ) => {
    const ukey = `${sectionKey}:${index}`;
    setUploadingKey(ukey);
    try {
      const webp = await compressToPreviewWebp(file);
      let url: string;
      try {
        url = await uploadImage(webp);
      } catch (uploadErr) {
        console.warn("CDN upload failed, using data URL", uploadErr);
        // Fallback: data URL from the compressed webp
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(webp);
        });
      }
      updateItemField(sectionKey, index, { image: url });
      showToast("预览图已上传");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploadingKey(null);
    }
  };

  const clearPreview = (sectionKey: string, index: number) => {
    updateItemField(sectionKey, index, { image: undefined });
  };

  const worldChars = characters.filter((c) => {
    const w = worlds.find((x) => x.id === targetWorldId);
    return w && c.world?.trim() === w.name;
  });

  const doImport = async () => {
    if (!prompt.trim()) { showToast("提示词为空"); return; }
    const stored: StoredPrompt = { id: crypto.randomUUID(), text: prompt, createdAt: new Date().toISOString() };
    if (importMode === "new") {
      const w = worlds.find((x) => x.id === targetWorldId);
      if (!w) { showToast("请选择世界"); return; }
      const name = newCharName.trim() || "Generated OC";
      const id = await addCharacter(name, w.name);
      updateCharacter(id, {
        prompts: [stored],
        tags: prompt.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      } as never);
      showToast("已创建角色");
      setImportOpen(false);
      router.push(`/character/${id}`);
    } else {
      if (!targetCharId) { showToast("请选择角色"); return; }
      const ch = characters.find((c) => c.id === targetCharId);
      if (!ch) return;
      updateCharacter(targetCharId, { prompts: [...(ch.prompts || []), stored] } as never);
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
            <div className="flex-1 font-mono text-xs text-neutral-400 bg-[#111] border border-neutral-800 rounded-lg px-3 py-2 max-h-16 overflow-y-auto break-all">{prompt || "（未选择）"}</div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <button onClick={copyPrompt} className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white">复制</button>
              <button type="button" onClick={sendPromptToComfy} className="px-3 py-1.5 text-sm rounded-lg border border-sky-700 text-sky-300 hover:bg-sky-950/40" title="写入抽卡姬的「角色提示词」栏">导入到抽卡姬</button>
              <Link href="/comfy" className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">打开抽卡姬</Link>
              <button onClick={() => setImportOpen(true)} className="px-3 py-1.5 text-sm rounded-lg border border-purple-700 text-purple-300 hover:bg-purple-950/40">导入角色卡</button>
              <button onClick={randomize} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">随机</button>
              <button onClick={reset} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">重置</button>
              <button onClick={clearAll} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">清除</button>
              <button onClick={lockAll} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">{data.sections.every((s) => locked[s.key]) ? "全部解锁" : "全部锁定"}</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-neutral-500 hover:text-white text-sm">← Worlds</Link>
            <h1 className="text-2xl font-bold text-white mt-1">角色外观生成器</h1>
            <p className="text-neutral-500 text-sm mt-1">组合外观标签；可编辑词库并保存为预设。</p>
          </div>
          <CatalogToolbar editMode={editMode} onToggleEdit={() => setEditMode((v) => !v)} onExport={handleExport} onImportFile={handleImportFile} onAddSection={openAddSection} />
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
            const en: Record<string, boolean> = {};
            d.sections.forEach((s) => {
              initSel[s.key] = 0;
              initLock[s.key] = typeof window !== "undefined" && localStorage.getItem("oc-gen-lock-" + s.key) === "1";
              const saved = typeof window !== "undefined" ? localStorage.getItem("oc-gen-sec-on-" + s.key) : null;
              en[s.key] = saved === null ? true : saved === "1";
            });
            setSelected(initSel);
            setLocked(initLock);
            setSectionEnabled(en);
          }}
        />

        <div className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setSectionPanelOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-900/60 transition">
            <div>
              <div className="text-sm font-semibold text-neutral-200">分区开关</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">已启用 {data.sections.filter((s) => sectionEnabled[s.key] !== false).length}/{data.sections.length} 个分区</div>
            </div>
            <span className="text-neutral-400 text-xs">{sectionPanelOpen ? "收起 ▲" : "展开 ▼"}</span>
          </button>
          {sectionPanelOpen && (
            <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-2">
              <div className="flex flex-wrap gap-2 mb-1">
                <button type="button" onClick={() => setAllSectionsEnabled(true)} className="px-2.5 py-1 text-[11px] rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">全部开启</button>
                <button type="button" onClick={() => setAllSectionsEnabled(false)} className="px-2.5 py-1 text-[11px] rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">全部关闭</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.sections.map((s) => {
                  const on = sectionEnabled[s.key] !== false;
                  return (
                    <button key={s.key} type="button" onClick={() => toggleSectionEnabled(s.key)} className={`px-2.5 py-1 text-xs rounded-lg border transition ${on ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200" : "border-neutral-800 text-neutral-600 line-through"}`}>
                      {on ? "✓ " : "○ "}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-neutral-800 rounded-xl p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-[11px] text-neutral-500 shrink-0">固定前缀 fixed:</label>
            <input
              className="flex-1 min-w-[120px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
              value={data.fixed || ""}
              onChange={(e) => persist({ ...data, fixed: e.target.value })}
              placeholder="1girl, "
            />
          </div>
        </div>

        {editMode && (
          <p className="text-xs text-amber-400/90 px-1">
            编辑模式：可直接改名称、提示词、上传预览图（自动压缩为 128×128 webp 并上传 CDN）。改完后请点「保存到当前预设」或「另存为新预设」。
          </p>
        )}

        {data.sections.length === 0 ? (
          <p className="text-center text-neutral-500 py-12 text-sm">暂无分区 · 请加载预设，或进入编辑模式添加</p>
        ) : (
          <div className="space-y-4">
            {data.sections.filter((section) => editMode || sectionEnabled[section.key] !== false).map((section) => (
              <div key={section.key} className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{section.icon ? `${section.icon} ` : ""}{section.label}</h3>
                    {section.desc && <p className="text-[11px] text-neutral-500 truncate">{section.desc}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editMode ? (
                      <>
                        <button type="button" onClick={() => openEditSection(section)} className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300">编辑分区</button>
                        <button type="button" onClick={() => deleteSection(section.key)} className="text-[11px] px-2 py-0.5 rounded border border-rose-900/50 text-rose-400">删除</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => toggleLock(section.key)} className={`text-[11px] px-2 py-0.5 rounded border ${locked[section.key] ? "border-amber-600 text-amber-300" : "border-neutral-700 text-neutral-400"}`}>
                        {locked[section.key] ? "已锁定" : "锁定"}
                      </button>
                    )}
                  </div>
                </div>

                {editMode ? (
                  <div className="p-3 space-y-2">
                    {section.items.map((item, idx) => {
                      const ukey = `${section.key}:${idx}`;
                      const isUploading = uploadingKey === ukey;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-lg border border-neutral-800 bg-[#0c0c0c] p-2"
                        >
                          {/* Preview thumbnail + upload */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                              {item.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">
                                  无图
                                </div>
                              )}
                              {isUploading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] text-white">
                                  …
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={(el) => {
                                  fileInputRefs.current[ukey] = el;
                                }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handlePreviewUpload(section.key, idx, f);
                                  e.target.value = "";
                                }}
                              />
                              <button
                                type="button"
                                disabled={!!uploadingKey}
                                onClick={() => fileInputRefs.current[ukey]?.click()}
                                className="text-[10px] px-2 py-0.5 rounded border border-sky-800/60 text-sky-300 hover:bg-sky-950/40 disabled:opacity-40"
                              >
                                {item.image ? "换图" : "上传"}
                              </button>
                              {item.image && (
                                <button
                                  type="button"
                                  onClick={() => clearPreview(section.key, idx)}
                                  className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:text-rose-400"
                                >
                                  清除
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-neutral-600 block mb-0.5">名称</label>
                              <input
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 text-neutral-200"
                                value={item.name}
                                onChange={(e) =>
                                  updateItemField(section.key, idx, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="blonde hair"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-neutral-600 block mb-0.5">提示词 tags</label>
                              <input
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500 text-neutral-200"
                                value={item.tags}
                                onChange={(e) =>
                                  updateItemField(section.key, idx, {
                                    tags: e.target.value,
                                  })
                                }
                                placeholder="blonde hair, "
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 sm:self-end">
                            {item.hex && (
                              <span
                                className="w-4 h-4 rounded-full border border-neutral-600"
                                style={{ background: item.hex }}
                                title={item.hex}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => deleteItem(section.key, idx)}
                              className="text-[11px] px-2 py-1 rounded border border-rose-900/50 text-rose-400 hover:bg-rose-950/30"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addItemInline(section.key)}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-dashed border-amber-700/60 text-amber-400/90 hover:bg-amber-950/20"
                    >
                      + 添加词条
                    </button>
                  </div>
                ) : (
                  <div className="p-3 flex flex-wrap gap-2">
                    {section.items.map((item, idx) => {
                      const active = selected[section.key] === idx;
                      return (
                        <div key={idx} className="relative group">
                          <button
                            type="button"
                            title={item.tags || item.name}
                            onClick={() => toggleItem(section.key, idx)}
                            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition ${
                              active
                                ? "border-purple-500 bg-purple-950/40 text-purple-200"
                                : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                            }`}
                          >
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt=""
                                className="w-6 h-6 rounded object-cover shrink-0 border border-neutral-700"
                                referrerPolicy="no-referrer"
                              />
                            ) : item.hex ? (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: item.hex }}
                              />
                            ) : null}
                            <span className="truncate max-w-[140px]">{item.name}</span>
                          </button>
                          {(item.tags || item.name) && (
                            <div className="pointer-events-none absolute left-0 bottom-full mb-1 z-30 hidden group-hover:block w-max max-w-[min(320px,70vw)] px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-600 text-[11px] text-neutral-200 shadow-xl whitespace-pre-wrap break-words">
                              {item.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image}
                                  alt=""
                                  className="w-16 h-16 rounded object-cover mb-1.5 border border-neutral-700"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {item.tags || item.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {sectionEditor && (
        <SectionEditorModal
          editor={sectionEditor}
          onChange={setSectionEditor}
          onClose={() => setSectionEditor(null)}
          onSave={saveSectionEditor}
        />
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
                {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                  {worldChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-white text-black text-sm shadow-lg">{toast}</div>}
    </div>
  );
}
