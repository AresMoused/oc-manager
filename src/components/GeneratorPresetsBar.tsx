"use client";

import { useMemo, useRef, useState } from "react";
import {
  BUILTIN_CATALOGS,
  CSV_IMPORT_SAMPLE,
  StoredBuilderPreset,
  createPresetFromData,
  deleteBuilderPreset,
  listBuilderPresets,
  loadBuiltinCatalog,
  loadPresetFromFile,
  loadPresetFromUrl,
  mergeSectionIntoPreset,
  parseCsvNamePrompt,
  renameBuilderPreset,
  setActivePresetId,
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

type ImportTarget = "new" | "existing";

const EMPTY_DATA: BuilderData = {
  id: "empty",
  name: "空词库",
  fixed: "1girl, ",
  sections: [],
};

export default function GeneratorPresetsBar({
  presets,
  activePresetId,
  onPresetsChange,
  toast,
  onSaveCurrent,
  onOverwriteCurrent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newPresetUrl, setNewPresetUrl] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvRaw, setCsvRaw] = useState("");
  const [csvSectionLabel, setCsvSectionLabel] = useState("导入分区");
  const [csvSectionKey, setCsvSectionKey] = useState("imported");
  const [csvCatalogName, setCsvCatalogName] = useState("");
  const [importTarget, setImportTarget] = useState<ImportTarget>("new");
  const [importPresetId, setImportPresetId] = useState("");
  const [mergeMode, setMergeMode] = useState<"append" | "replace">("append");

  /** Always a valid option value so <select> never sticks on a deleted id */
  const selectValue = useMemo(() => {
    if (presets.some((p) => p.id === activePresetId)) return activePresetId;
    return presets[0]?.id || "";
  }, [presets, activePresetId]);

  const activeName =
    presets.find((p) => p.id === selectValue)?.name ||
    presets.find((p) => p.id === activePresetId)?.name ||
    "未选择";

  const refresh = (data: BuilderData, id: string) => {
    onPresetsChange(listBuilderPresets(), id, data);
  };

  const switchPreset = (id: string) => {
    if (!id) return;
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

  const handleDeletePreset = (id?: string) => {
    const targetId = id || activePresetId || selectValue;
    if (!targetId) {
      toast("没有可删除的预设");
      return;
    }
    const target = presets.find((p) => p.id === targetId);
    const label = target?.name || targetId;
    if (!confirm(`删除预设「${label}」？此操作不可撤销。`)) return;

    const list = deleteBuilderPreset(targetId);
    if (list.length === 0) {
      onPresetsChange([], "", EMPTY_DATA);
      toast(`已删除「${label}」`);
      return;
    }
    const stillActive = list.find((p) => p.id === activePresetId);
    const next = stillActive || list[0];
    setActivePresetId(next.id);
    onPresetsChange(list, next.id, next.data);
    toast(`已删除「${label}」`);
  };

  const handleRenamePreset = (id?: string) => {
    const targetId = id || activePresetId || selectValue;
    if (!targetId) {
      toast("没有可重命名的预设");
      return;
    }
    const target = presets.find((p) => p.id === targetId);
    const current = target?.name || "";
    const name = window.prompt("预设新名称", current);
    if (name === null) return;
    if (!name.trim()) {
      toast("名称不能为空");
      return;
    }
    const updated = renameBuilderPreset(targetId, name.trim());
    if (!updated) {
      toast("重命名失败");
      return;
    }
    const list = listBuilderPresets();
    const activeId =
      list.find((p) => p.id === activePresetId)?.id || updated.id;
    const activeData =
      list.find((p) => p.id === activeId)?.data || updated.data;
    onPresetsChange(list, activeId, activeData);
    toast(`已重命名为「${updated.name}」`);
  };

  const openCsvImport = () => {
    setImportPresetId(selectValue || presets[0]?.id || "");
    setImportTarget(presets.length ? "existing" : "new");
    setCsvImportOpen(true);
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([CSV_IMPORT_SAMPLE], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "词库导入范例.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runCsvImport = () => {
    try {
      const data = parseCsvNamePrompt(csvRaw, {
        sectionLabel: csvSectionLabel.trim() || "导入分区",
        sectionKey: (csvSectionKey.trim() || "imported").replace(/\s+/g, "_"),
        catalogName: csvCatalogName.trim() || "CSV 导入词库",
      });
      const section = data.sections[0];
      if (!section) throw new Error("无分区");

      if (importTarget === "existing") {
        const pid = importPresetId || selectValue;
        if (!pid) {
          toast("请选择目标预设");
          return;
        }
        const updated = mergeSectionIntoPreset(pid, section, {
          replaceItems: mergeMode === "replace",
        });
        refresh(updated.data, updated.id);
        setCsvImportOpen(false);
        setCsvRaw("");
        toast(
          `已${mergeMode === "replace" ? "覆盖" : "合并"} ${section.items.length} 条到「${updated.name}」`
        );
      } else {
        const preset = createPresetFromData(data.name || "CSV 导入词库", data);
        refresh(preset.data, preset.id);
        setCsvImportOpen(false);
        setCsvRaw("");
        toast(`已新建预设并导入 ${section.items.length} 条 → ${preset.name}`);
      }
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
              value={selectValue}
              onChange={(e) => switchPreset(e.target.value)}
            >
              {presets.length === 0 && <option value="">（无预设）</option>}
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.data.sections.length} 分区
                </option>
              ))}
            </select>
            <button type="button" onClick={() => handleRenamePreset()} disabled={!selectValue} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">重命名</button>
            <button type="button" onClick={() => handleDeletePreset()} disabled={!selectValue} className="px-3 py-1.5 text-xs rounded-lg border border-rose-900/50 text-rose-400 hover:bg-rose-950/30 disabled:opacity-40">删除</button>
            <button type="button" onClick={() => setManageOpen((v) => !v)} className="px-3 py-1.5 text-xs rounded-lg border border-sky-800/60 text-sky-300 hover:bg-sky-950/40">{manageOpen ? "收起管理" : "词库管理"}</button>
          </div>

          {manageOpen && (
            <div className="rounded-lg border border-neutral-800 bg-[#0c0c0c] p-3 space-y-2">
              <div className="text-xs text-neutral-400">管理全部预设（重命名 / 删除）</div>
              {presets.length === 0 ? (
                <p className="text-xs text-neutral-600 py-2 text-center">暂无预设</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {presets.map((p) => (
                    <li key={p.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${p.id === selectValue ? "border-purple-700/50 bg-purple-950/20" : "border-neutral-800"}`}>
                      <button type="button" onClick={() => switchPreset(p.id)} className="flex-1 min-w-0 text-left">
                        <div className="text-sm text-neutral-200 truncate">
                          {p.name}
                          {p.id === selectValue && <span className="ml-1.5 text-[10px] text-purple-400">使用中</span>}
                        </div>
                        <div className="text-[10px] text-neutral-600">
                          {p.data.sections.length} 分区 · {p.data.sections.reduce((n, s) => n + s.items.length, 0)} 词条
                        </div>
                      </button>
                      <button type="button" onClick={() => handleRenamePreset(p.id)} className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 shrink-0">改名</button>
                      <button type="button" onClick={() => handleDeletePreset(p.id)} className="text-[11px] px-2 py-0.5 rounded border border-rose-900/50 text-rose-400 hover:bg-rose-950/30 shrink-0">删除</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {onOverwriteCurrent && (
              <button type="button" onClick={onOverwriteCurrent} className="px-3 py-1.5 text-xs rounded-lg border border-emerald-800 text-emerald-300 hover:bg-emerald-950/40">保存到当前预设</button>
            )}
            {onSaveCurrent && (
              <button type="button" onClick={onSaveCurrent} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white">另存为新预设</button>
            )}
            {BUILTIN_CATALOGS.map((c) => (
              <button key={c.id} type="button" onClick={() => handleLoadBuiltin(c.file, c.name)} className="px-2.5 py-1 text-[11px] rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">加载内置：{c.name}</button>
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
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">从 JSON 文件导入</button>
            <button type="button" onClick={openCsvImport} className="px-3 py-1.5 text-xs rounded-lg border border-sky-800 text-sky-300 hover:bg-sky-950/40">从 CSV 导入（名字,提示词）</button>
          </div>
        </div>
      )}

      {csvImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">从 CSV 导入词库</h2>
            <p className="text-xs text-neutral-500">
              每行两条：<code className="text-neutral-300">名字,提示词</code>
              。第一行可以是表头。提示词含逗号时请用双引号包裹。
            </p>

            <div className="rounded-lg border border-neutral-800 bg-[#0c0c0c] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-400">参考范例</span>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-[11px] text-sky-400 hover:text-sky-300"
                >
                  下载范例 CSV
                </button>
              </div>
              <pre className="text-[11px] font-mono text-neutral-400 whitespace-pre-wrap break-all leading-relaxed">
                {CSV_IMPORT_SAMPLE}
              </pre>
            </div>

            <div>
              <label className="text-xs text-neutral-500 block mb-1">导入目标</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setImportTarget("new")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${importTarget === "new" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>新建预设</button>
                <button type="button" onClick={() => setImportTarget("existing")} className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${importTarget === "existing" ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}>合并到已有预设</button>
              </div>
            </div>

            {importTarget === "existing" && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">目标预设</label>
                  <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={presets.some((p) => p.id === importPresetId) ? importPresetId : presets[0]?.id || ""} onChange={(e) => setImportPresetId(e.target.value)}>
                    {presets.length === 0 && <option value="">（无预设）</option>}
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">若分区 key 已存在</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMergeMode("append")} className={`flex-1 px-3 py-1.5 text-xs rounded-lg border ${mergeMode === "append" ? "border-emerald-600 text-emerald-200" : "border-neutral-700 text-neutral-400"}`}>追加词条</button>
                    <button type="button" onClick={() => setMergeMode("replace")} className={`flex-1 px-3 py-1.5 text-xs rounded-lg border ${mergeMode === "replace" ? "border-amber-600 text-amber-200" : "border-neutral-700 text-neutral-400"}`}>覆盖整个分区</button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {importTarget === "new" && (
                <div className="sm:col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">新预设名称</label>
                  <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={csvCatalogName} onChange={(e) => setCsvCatalogName(e.target.value)} placeholder="例如：性感泳装" />
                </div>
              )}
              <div>
                <label className="text-xs text-neutral-500 block mb-1">分区名称</label>
                <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={csvSectionLabel} onChange={(e) => setCsvSectionLabel(e.target.value)} placeholder="导入分区" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">分区 key</label>
                <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500" value={csvSectionKey} onChange={(e) => setCsvSectionKey(e.target.value)} placeholder="imported" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-neutral-500">CSV 内容</label>
                <div>
                  <input
                    ref={csvFileRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setCsvRaw(await f.text());
                      if (!csvCatalogName.trim()) {
                        setCsvCatalogName(f.name.replace(/\.(csv|txt)$/i, ""));
                      }
                      e.target.value = "";
                    }}
                  />
                  <button type="button" onClick={() => csvFileRef.current?.click()} className="text-[11px] text-sky-400 hover:text-sky-300">从 .csv 文件载入</button>
                </div>
              </div>
              <textarea
                className="w-full min-h-[160px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500 resize-y"
                value={csvRaw}
                onChange={(e) => setCsvRaw(e.target.value)}
                placeholder={'名字,提示词\nblonde hair,"blonde hair, long hair, "'}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCsvImportOpen(false)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button type="button" onClick={runCsvImport} disabled={!csvRaw.trim()} className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white">导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
