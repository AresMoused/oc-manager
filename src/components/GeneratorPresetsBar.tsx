"use client";

import { useRef, useState } from "react";
import {
  BUILTIN_CATALOGS,
  StoredBuilderPreset,
  deleteBuilderPreset,
  listBuilderPresets,
  loadBuiltinCatalog,
  loadPresetFromFile,
  loadPresetFromUrl,
  setActivePresetId,
} from "@/lib/promptBuilder";
import type { BuilderData } from "@/lib/promptBuilder";

interface Props {
  presets: StoredBuilderPreset[];
  activePresetId: string;
  onPresetsChange: (list: StoredBuilderPreset[], activeId: string, data: BuilderData) => void;
  toast: (msg: string) => void;
}

export default function GeneratorPresetsBar({
  presets,
  activePresetId,
  onPresetsChange,
  toast,
}: Props) {
  const [newPresetUrl, setNewPresetUrl] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const cat = BUILTIN_CATALOGS.find((c) => c.file === file) || { id: name, name, file };
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
      const preset = await loadPresetFromUrl(newPresetUrl.trim(), newPresetName.trim() || undefined);
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
      const preset = await loadPresetFromFile(file, newPresetName.trim() || undefined);
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

  return (
    <div className="bg-[#111] border border-neutral-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-200">词库预设 / Character presets</h2>
        <span className="text-[11px] text-neutral-500">不同背景可切换不同 JSON 词库</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="flex-1 min-w-[160px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
          value={activePresetId}
          onChange={(e) => switchPreset(e.target.value)}
        >
          {presets.length === 0 && <option value="">（无预设）</option>}
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.data.sections.length} 分区</option>
          ))}
        </select>
        <button type="button" onClick={handleDeletePreset} className="px-3 py-1.5 text-xs rounded-lg border border-rose-900/50 text-rose-400 hover:bg-rose-950/30">删除当前</button>
      </div>
      <div className="flex flex-wrap gap-2">
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
      <div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFromFile(f); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">从 JSON 文件导入为新预设</button>
      </div>
    </div>
  );
}
