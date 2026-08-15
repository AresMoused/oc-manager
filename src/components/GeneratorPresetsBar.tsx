"use client";

import { useRef, useState } from "react";
import {
  BUILTIN_CATALOGS,
  StoredBuilderPreset,
  createPresetFromData,
  deleteBuilderPreset,
  listBuilderPresets,
  loadBuiltinCatalog,
  loadPresetFromFile,
  loadPresetFromUrl,
  parseNameColonTextList,
  setActivePresetId,
  TextListNameMode,
} from "@/lib/promptBuilder";
import type { BuilderData } from "@/lib/promptBuilder";

interface Props {
  presets: StoredBuilderPreset[];
  activePresetId: string;
  onPresetsChange: (
    list: StoredBuilderPreset[],
    activeId: string,
    data: BuilderData
  ) => void;
  toast: (msg: string) => void;
  onSaveCurrent?: () => void;
  onOverwriteCurrent?: () => void;
}

export default function GeneratorPresetsBar({
  presets,
  activePresetId,
  onPresetsChange,
  toast,
  onSaveCurrent,
  onOverwriteCurrent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [newPresetUrl, setNewPresetUrl] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textFileRef = useRef<HTMLInputElement>(null);

  const [textImportOpen, setTextImportOpen] = useState(false);
  const [textRaw, setTextRaw] = useState("");
  const [textNameMode, setTextNameMode] = useState<TextListNameMode>("title");
  const [textSectionLabel, setTextSectionLabel] = useState("导入分区");
  const [textCatalogName, setTextCatalogName] = useState("");

  const activeName =
    presets.find((p) => p.id === activePresetId)?.name || "未选择";

  const refresh = (data: BuilderData, id: string) => {
    onPresetsChange(listBuilderPresets(), id, data);
  };

  const switchPreset = (id: string) => {
    setActivePresetId(id);
    const p = listBuilderPresets().find((x) => x.id === id);
    if (p) {
      refresh(p.data, p.id);
      toast(`已切换：${p.name}`);
    }
  };

  const handleLoadBuiltin = async (file: string, name: string) => {
    try {
      const cat = BUILTIN_CATALOGS.find((c) => c.file === file) || {
        id: name,
        name,
        file,
      };
      const preset = await loadBuiltinCatalog(cat);
      refresh(preset.data, preset.id);
      toast(`已加载预设：${preset.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "加载失败");
    }
  };

  const handleAddFromUrl = async () => {
    if (!newPresetUrl.trim()) return;
    try {
      const preset = await loadPresetFromUrl(
        newPresetUrl.trim(),
        newPresetName.trim() || undefined
      );
      refresh(preset.data, preset.id);
      setNewPresetUrl("");
      setNewPresetName("");
      toast(`已添加预设：${preset.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "加载失败");
    }
  };

  const handleAddFromFile = async (file: File) => {
    try {
      const preset = await loadPresetFromFile(
        file,
        newPresetName.trim() || undefined
      );
      refresh(preset.data, preset.id);
      setNewPresetName("");
      toast(`已导入预设：${preset.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "导入失败");
    }
  };

  const handleDeletePreset = () => {
    if (!activePresetId) return;
    if (presets.length <= 1) {
      toast("至少保留一个预设");
      return;
    }
    if (!confirm("删除当前预设？")) return;
    deleteBuilderPreset(activePresetId);
    const list = listBuilderPresets();
    const next = list[0];
    if (next) {
      setActivePresetId(next.id);
      refresh(next.data, next.id);
    }
  };

  const runTextImport = () => {
    try {
      const data = parseNameColonTextList(textRaw, {
        nameMode: textNameMode,
        sectionLabel: textSectionLabel.trim() || "导入分区",
        sectionKey: "imported",
        catalogName: textCatalogName.trim() || "文本导入词库",
      });
      const preset = createPresetFromData(data.name || "文本导入词库", data);
      refresh(preset.data, preset.id);
      setTextImportOpen(false);
      setTextRaw("");
      toast(`已导入 ${data.sections[0]?.items.length || 0} 条 → ${preset.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "解析失败");
    }
  };

  return (
    <div className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-900/60 transition"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-200">词库预设</div>
          <div className="text-[11px] text-neutral-500 truncate mt-0.5">
            当前：{activeName}
            {presets.length > 0 ? ` · 共 ${presets.length} 套` : ""}
          </div>
        </div>
        <span className="text-neutral-400 text-xs shrink-0">{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-neutral-800 pt-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="flex-1 min-w-[160px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
              value={activePresetId}
              onChange={(e) => switchPreset(e.target.value)}
            >
              {presets.length === 0 && <option value="">（无预设）</option>}
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.data.sections.length} 分区
                </option>
              ))}
            </select>
            <button type="button" onClick={handleDeletePreset} className="px-3 py-1.5 text-xs rounded-lg border border-rose-900/50 text-rose-400 hover:bg-rose-950/30">
              删除当前
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {onOverwriteCurrent && (
              <button type="button" onClick={onOverwriteCurrent} className="px-3 py-1.5 text-xs rounded-lg border border-emerald-800 text-emerald-300 hover:bg-emerald-950/40">
                保存到当前预设
              </button>
            )}
            {onSaveCurrent && (
              <button type="button" onClick={onSaveCurrent} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white">
                另存为新预设
              </button>
            )}
            {BUILTIN_CATALOGS.map((c) => (
              <button key={c.id} type="button" onClick={() => handleLoadBuiltin(c.file, c.name)} className="px-2.5 py-1 text-[11px] rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                加载内置：{c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500" placeholder="新预设名称（可选）" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500" placeholder="从 URL 加载 JSON…" value={newPresetUrl} onChange={(e) => setNewPresetUrl(e.target.value)} />
              <button type="button" onClick={handleAddFromUrl} className="px-3 py-1.5 text-xs rounded-lg bg-purple-700 hover:bg-purple-600 text-white shrink-0">添加</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFromFile(f); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
              从 JSON 文件导入
            </button>
            <button type="button" onClick={() => setTextImportOpen(true)} className="px-3 py-1.5 text-xs rounded-lg border border-sky-800 text-sky-300 hover:bg-sky-950/40">
              从文本列表导入（Name: desc）
            </button>
          </div>
        </div>
      )}

      {textImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">从文本列表导入词库</h2>
            <p className="text-xs text-neutral-500">
              每行一条：<code className="text-neutral-400">名称: 描述</code>。会自动转成 JSON 词库分区。
            </p>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">条目显示名称</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTextNameMode("title")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${textNameMode === "title" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>
                  使用文本标题
                </button>
                <button type="button" onClick={() => setTextNameMode("id")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${textNameMode === "id" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>
                  使用 ID（item_001…）
                </button>
              </div>
              <p className="text-[11px] text-neutral-600 mt-1">
                {textNameMode === "title"
                  ? "名称用冒号前的文字；过长会截断显示，完整内容写入 tags。"
                  : "名称用 item_001 递增 ID，适合标题过长的列表。"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">预设名称</label>
                <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={textCatalogName} onChange={(e) => setTextCatalogName(e.target.value)} placeholder="例如：性感泳装" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">分区名称</label>
                <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={textSectionLabel} onChange={(e) => setTextSectionLabel(e.target.value)} placeholder="导入分区" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-neutral-500">文本内容</label>
                <div>
                  <input ref={textFileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setTextRaw(await f.text());
                    if (!textCatalogName.trim()) setTextCatalogName(f.name.replace(/\.(txt|text)$/i, ""));
                    e.target.value = "";
                  }} />
                  <button type="button" onClick={() => textFileRef.current?.click()} className="text-[11px] text-sky-400 hover:text-sky-300">从 .txt 文件载入</button>
                </div>
              </div>
              <textarea className="w-full min-h-[180px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500 resize-y" value={textRaw} onChange={(e) => setTextRaw(e.target.value)} placeholder={"The Daring Monokini: A one-piece swimsuit...\nThe String Bikini: A barely-there bikini..."} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTextImportOpen(false)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button type="button" onClick={runTextImport} disabled={!textRaw.trim()} className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white">转换并导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
