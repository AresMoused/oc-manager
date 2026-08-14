"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWorlds } from "@/hooks/useWorlds";
import { useCharacters } from "@/hooks/useCharacters";
import {
  AiApiConfig,
  AiModelParams,
  ContextEntry,
  ContextPreset,
  ContextRole,
  chatCompletion,
  defaultApiConfig,
  defaultCharacterPreset,
  defaultModelParams,
  fetchModels,
  loadActivePresetId,
  loadApiConfig,
  loadModelParams,
  loadPresets,
  parseCharacterJson,
  saveActivePresetId,
  saveApiConfig,
  saveModelParams,
  savePresets,
} from "@/lib/aiConfig";
import {
  BipolarDotItem,
  BipolarSliderItem,
  Character,
  DotItem,
  defaultCharacter,
} from "@/lib/types";

function newId() {
  return crypto.randomUUID();
}

function roleLabel(role: ContextRole) {
  if (role === "system") return "SYS";
  if (role === "assistant") return "AI";
  return "USR";
}

function roleColor(role: ContextRole) {
  if (role === "system") return "bg-amber-700 text-amber-100";
  if (role === "assistant") return "bg-emerald-700 text-emerald-100";
  return "bg-blue-700 text-blue-100";
}

export default function AiGeneratePage() {
  const { worlds, loaded: worldsLoaded } = useWorlds();
  const { addCharacter, loaded: charsLoaded } = useCharacters();

  const [cfg, setCfg] = useState<AiApiConfig>(defaultApiConfig());
  const [params, setParams] = useState<AiModelParams>(defaultModelParams());
  const [presets, setPresets] = useState<ContextPreset[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);

  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelMsg, setModelMsg] = useState("");

  const [userPrompt, setUserPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [targetWorldId, setTargetWorldId] = useState("");
  const [newCharName, setNewCharName] = useState("");
  const [toast, setToast] = useState("");
  const [editingEntry, setEditingEntry] = useState<ContextEntry | null>(null);

  useEffect(() => {
    const c = loadApiConfig();
    const p = loadModelParams();
    let list = loadPresets();
    if (!list.length) list = [defaultCharacterPreset()];
    let aid = loadActivePresetId();
    if (!list.find((x) => x.id === aid)) aid = list[0].id;
    setCfg(c);
    setParams(p);
    setPresets(list);
    setActiveId(aid);
    setReady(true);
  }, []);

  useEffect(() => {
    if (worldsLoaded && worlds.length && !targetWorldId) {
      setTargetWorldId(worlds[0].id);
    }
  }, [worldsLoaded, worlds, targetWorldId]);

  const active = useMemo(
    () => presets.find((p) => p.id === activeId) || presets[0],
    [presets, activeId]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const persistCfg = (next: AiApiConfig) => {
    setCfg(next);
    saveApiConfig(next);
  };

  const persistParams = (next: AiModelParams) => {
    setParams(next);
    saveModelParams(next);
  };

  const persistPresets = (next: ContextPreset[]) => {
    setPresets(next);
    savePresets(next);
  };

  const updateActive = (patch: Partial<ContextPreset>) => {
    if (!active) return;
    const next = presets.map((p) =>
      p.id === active.id
        ? { ...p, ...patch, updatedAt: new Date().toISOString() }
        : p
    );
    persistPresets(next);
  };

  const handleFetchModels = async () => {
    if (!cfg.apiKey.trim()) {
      setModelMsg("请先填写 API Key");
      return;
    }
    setFetchingModels(true);
    setModelMsg("");
    try {
      const models = await fetchModels(cfg.baseUrl, cfg.apiKey);
      const next = {
        ...cfg,
        models,
        model: models.includes(cfg.model) ? cfg.model : models[0] || cfg.model,
      };
      persistCfg(next);
      setModelMsg(`已获取 ${models.length} 个模型`);
    } catch (e) {
      setModelMsg(e instanceof Error ? e.message : "获取失败");
    } finally {
      setFetchingModels(false);
    }
  };

  const handleGenerate = async () => {
    if (!active) return;
    if (!cfg.apiKey.trim()) {
      setError("请先配置 API Key（仅保存在本浏览器）");
      return;
    }
    if (!userPrompt.trim()) {
      setError("请输入角色概念 / 生成指令");
      return;
    }
    setError("");
    setGenerating(true);
    setOutput("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const text = await chatCompletion({
        config: cfg,
        params,
        preset: active,
        userPrompt: userPrompt.trim(),
        signal: ac.signal,
        onDelta: (t) => setOutput(t),
      });
      setOutput(text);
      showToast("生成完成");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        showToast("已停止");
      } else {
        setError(e instanceof Error ? e.message : "生成失败");
      }
    } finally {
      setGenerating(false);
    }
  };

  const stopGenerate = () => {
    abortRef.current?.abort();
  };

  const buildCharacterFromOutput = useCallback((): Partial<Character> => {
    const parsed = parseCharacterJson(output);
    const base = defaultCharacter();
    if (!parsed) {
      return {
        ...base,
        name: newCharName.trim() || "AI 角色",
        story: output,
      };
    }
    const traits = Array.isArray(parsed.traits)
      ? (parsed.traits as BipolarSliderItem[]).map((t) => ({
          id: t.id || newId(),
          leftLabel: t.leftLabel || "左",
          rightLabel: t.rightLabel || "右",
          value: Number(t.value) || 50,
        }))
      : base.traits;
    const emotions = Array.isArray(parsed.emotions)
      ? (parsed.emotions as BipolarDotItem[]).map((t) => ({
          id: t.id || newId(),
          leftLabel: t.leftLabel || "左",
          rightLabel: t.rightLabel || "右",
          value: Number(t.value) || 3,
        }))
      : base.emotions;
    const happiness = Array.isArray(parsed.happiness)
      ? (parsed.happiness as DotItem[]).map((t) => ({
          id: t.id || newId(),
          label: t.label || "项",
          value: Number(t.value) || 3,
        }))
      : base.happiness;
    const outward = Array.isArray(parsed.outward)
      ? (parsed.outward as DotItem[]).map((t) => ({
          id: t.id || newId(),
          label: t.label || "项",
          value: Number(t.value) || 3,
        }))
      : base.outward;
    const combat =
      parsed.combat && typeof parsed.combat === "object"
        ? {
            experience:
              Number((parsed.combat as Character["combat"]).experience) || 50,
            collaboration:
              Number((parsed.combat as Character["combat"]).collaboration) || 50,
            conflict:
              Number((parsed.combat as Character["combat"]).conflict) || 50,
            intelligence:
              Number((parsed.combat as Character["combat"]).intelligence) || 50,
            adaptability:
              Number((parsed.combat as Character["combat"]).adaptability) || 50,
          }
        : base.combat;

    return {
      ...base,
      name: String(parsed.name || newCharName.trim() || "AI 角色"),
      gender: String(parsed.gender || base.gender),
      age: (parsed.age as string | number) ?? base.age,
      race: String(parsed.race || base.race),
      height: String(parsed.height || base.height),
      weight: String(parsed.weight || base.weight),
      affiliation: String(parsed.affiliation || base.affiliation),
      identity: String(parsed.identity || base.identity),
      residence: String(parsed.residence || ""),
      faction: String(parsed.faction || ""),
      birthplace: String(parsed.birthplace || ""),
      story: String(parsed.story || output),
      traits,
      emotions,
      happiness,
      outward,
      combat,
    };
  }, [output, newCharName]);

  const handleImportCard = async () => {
    if (!output.trim()) {
      showToast("没有生成内容");
      return;
    }
    const w = worlds.find((x) => x.id === targetWorldId);
    const partial = buildCharacterFromOutput();
    try {
      await addCharacter({
        ...partial,
        name: newCharName.trim() || partial.name || "AI 角色",
        world: w?.name || "",
      });
      setImportOpen(false);
      showToast("已导入为角色卡");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导入失败");
    }
  };

  const addPreset = () => {
    const p: ContextPreset = {
      id: newId(),
      name: `预设 ${presets.length + 1}`,
      entries: [],
      updatedAt: new Date().toISOString(),
    };
    persistPresets([...presets, p]);
    setActiveId(p.id);
    saveActivePresetId(p.id);
  };

  const deletePreset = () => {
    if (!active || presets.length <= 1) {
      showToast("至少保留一个预设");
      return;
    }
    if (!confirm(`删除预设「${active.name}」？`)) return;
    const next = presets.filter((p) => p.id !== active.id);
    persistPresets(next);
    setActiveId(next[0].id);
    saveActivePresetId(next[0].id);
  };

  const addEntry = () => {
    if (!active) return;
    const entry: ContextEntry = {
      id: newId(),
      role: "user",
      name: `条目 ${active.entries.length + 1}`,
      content: "",
      enabled: true,
    };
    updateActive({ entries: [...active.entries, entry] });
    setEditingEntry(entry);
  };

  const updateEntry = (id: string, patch: Partial<ContextEntry>) => {
    if (!active) return;
    updateActive({
      entries: active.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const deleteEntry = (id: string) => {
    if (!active) return;
    updateActive({ entries: active.entries.filter((e) => e.id !== id) });
  };

  const moveEntry = (id: string, dir: -1 | 1) => {
    if (!active) return;
    const idx = active.entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= active.entries.length) return;
    const arr = [...active.entries];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    updateActive({ entries: arr });
  };

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
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-5">
        <div>
          <Link href="/" className="text-neutral-500 hover:text-white text-sm">
            ← Worlds
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">AI 生成角色卡</h1>
          <p className="text-neutral-500 text-sm mt-1">
            API Key 仅保存在本浏览器本地。生成结果可直接导入为角色卡。
          </p>
        </div>

        <section className="bg-[#141414] border border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-200">API 配置</h2>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">
              API Base URL（可加 /v1 后缀）
            </label>
            <input
              className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-purple-500 text-neutral-200"
              value={cfg.baseUrl}
              onChange={(e) => persistCfg({ ...cfg, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">API Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                className="w-full bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-purple-500 text-neutral-200 pr-10"
                value={cfg.apiKey}
                onChange={(e) => persistCfg({ ...cfg, apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs px-2"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">模型选择</label>
            <div className="flex flex-wrap gap-2 items-center">
              {cfg.models.length > 0 ? (
                cfg.models.slice(0, 12).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => persistCfg({ ...cfg, model: m })}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      cfg.model === m
                        ? "border-purple-500 bg-purple-950/40 text-purple-200"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                    }`}
                  >
                    {m}
                  </button>
                ))
              ) : (
                <input
                  className="flex-1 min-w-[160px] bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500"
                  value={cfg.model}
                  onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}
                  placeholder="deepseek-chat"
                />
              )}
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={fetchingModels}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                {fetchingModels ? "获取中…" : "连接并获取模型"}
              </button>
            </div>
            {cfg.models.length > 0 && (
              <input
                className="mt-2 w-full bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500"
                value={cfg.model}
                onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}
                list="ai-models"
              />
            )}
            <datalist id="ai-models">
              {cfg.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {modelMsg && (
              <p className="text-xs text-neutral-500 mt-1.5 break-all">{modelMsg}</p>
            )}
          </div>
          {(
            [
              ["stream", "流式生成", cfg.stream],
              ["noTavernProxy", "不通过酒馆代理", cfg.noTavernProxy],
              ["mergeSystemUser", "合并 System 和 User", cfg.mergeSystemUser],
              ["sendImages", "发送图片", cfg.sendImages],
            ] as const
          ).map(([key, label, val]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-neutral-300">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={val}
                onClick={() => persistCfg({ ...cfg, [key]: !val })}
                className={`w-11 h-6 rounded-full transition relative ${
                  val ? "bg-purple-600" : "bg-neutral-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${
                    val ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </section>

        <section className="bg-[#141414] border border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-200">模型参数</h2>
          {(
            [
              ["temperature", "Temperature", 0, 2, 0.05, params.temperature],
              ["topP", "Top P", 0, 1, 0.05, params.topP],
              ["maxTokens", "Max Tokens", 256, 16000, 64, params.maxTokens],
            ] as const
          ).map(([key, label, min, max, step, val]) => (
            <div key={key} className="flex flex-wrap items-center gap-3">
              <span className="w-28 text-sm text-neutral-400 shrink-0">{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) =>
                  persistParams({ ...params, [key]: Number(e.target.value) })
                }
                className="flex-1 min-w-[120px] accent-purple-500"
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) =>
                  persistParams({ ...params, [key]: Number(e.target.value) })
                }
                className="w-20 bg-[#1a1a1a] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-purple-300 tabular-nums outline-none focus:border-purple-500"
              />
            </div>
          ))}
        </section>

        <section className="bg-[#141414] border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-200">上下文配置</h2>
            <div className="flex items-center gap-1.5">
              <select
                className="bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-500 max-w-[200px]"
                value={activeId}
                onChange={(e) => {
                  setActiveId(e.target.value);
                  saveActivePresetId(e.target.value);
                }}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addPreset} className="w-8 h-8 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800" title="新建预设">+</button>
              <button type="button" onClick={() => { const name = prompt("预设名称", active?.name || ""); if (name != null && active) updateActive({ name: name.trim() || active.name }); }} className="w-8 h-8 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800" title="重命名">✎</button>
              <button type="button" onClick={deletePreset} className="w-8 h-8 rounded-lg border border-rose-900/50 text-rose-400 hover:bg-rose-950/30" title="删除预设">×</button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">上下文预设 · 生成时按顺序发送启用的条目</p>
          <button type="button" onClick={addEntry} className="w-full py-2.5 rounded-lg border border-dashed border-neutral-700 text-neutral-400 hover:border-purple-600 hover:text-purple-300 text-sm">+ 添加条目</button>
          <div className="space-y-2">
            {(active?.entries || []).map((entry) => (
              <div key={entry.id} className={`flex items-start gap-2 p-3 rounded-lg border bg-[#0c0c0c] ${entry.enabled ? "border-neutral-700" : "border-neutral-800 opacity-50"}`}>
                <span className={`shrink-0 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${roleColor(entry.role)}`}>{roleLabel(entry.role)}</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="bg-transparent border-b border-transparent focus:border-neutral-600 outline-none text-sm text-neutral-200 w-28" value={entry.name} onChange={(e) => updateEntry(entry.id, { name: e.target.value })} />
                    <select className="bg-[#1a1a1a] border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] outline-none" value={entry.role} onChange={(e) => updateEntry(entry.id, { role: e.target.value as ContextRole })}>
                      <option value="system">system</option>
                      <option value="user">user</option>
                      <option value="assistant">assistant</option>
                    </select>
                  </div>
                  <p className="text-xs text-neutral-500 line-clamp-2 font-mono break-all">{entry.content || "（空）"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" role="switch" aria-checked={entry.enabled} onClick={() => updateEntry(entry.id, { enabled: !entry.enabled })} className={`w-9 h-5 rounded-full relative ${entry.enabled ? "bg-purple-600" : "bg-neutral-700"}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${entry.enabled ? "translate-x-4" : ""}`} /></button>
                  <button type="button" onClick={() => moveEntry(entry.id, -1)} className="w-7 h-7 rounded border border-neutral-700 text-neutral-400 text-xs">↑</button>
                  <button type="button" onClick={() => moveEntry(entry.id, 1)} className="w-7 h-7 rounded border border-neutral-700 text-neutral-400 text-xs">↓</button>
                  <button type="button" onClick={() => setEditingEntry(entry)} className="w-7 h-7 rounded border border-neutral-700 text-neutral-300 text-xs">✎</button>
                  <button type="button" onClick={() => deleteEntry(entry.id)} className="w-7 h-7 rounded border border-rose-900/40 text-rose-400 text-xs">×</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#141414] border border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">生成指令</h2>
          <textarea className="w-full min-h-[100px] bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 text-neutral-200 resize-y" placeholder="描述你想要的角色，例如：一位来自溪木镇的精灵斥候……" value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {!generating ? (
              <button type="button" onClick={handleGenerate} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">生成角色卡</button>
            ) : (
              <button type="button" onClick={stopGenerate} className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm">停止</button>
            )}
            <button type="button" onClick={() => { if (!output.trim()) { showToast("没有内容可导入"); return; } setNewCharName(String(parseCharacterJson(output)?.name || "") || ""); setImportOpen(true); }} disabled={!output.trim()} className="px-4 py-2 rounded-lg border border-purple-700 text-purple-300 hover:bg-purple-950/40 text-sm disabled:opacity-40">导入为角色卡</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(output); showToast("已复制"); } catch { showToast("复制失败"); } }} disabled={!output.trim()} className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm disabled:opacity-40">复制输出</button>
          </div>
          {error && <p className="text-sm text-rose-400 break-all">{error}</p>}
          {output && (
            <pre className="max-h-96 overflow-auto bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-300 whitespace-pre-wrap break-all">{output}</pre>
          )}
        </section>
      </main>
      <Footer />

      {editingEntry && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-3">
            <h3 className="text-lg font-semibold text-white">编辑条目</h3>
            <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={editingEntry.name} onChange={(e) => setEditingEntry({ ...editingEntry, name: e.target.value })} placeholder="名称" />
            <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none" value={editingEntry.role} onChange={(e) => setEditingEntry({ ...editingEntry, role: e.target.value as ContextRole })}>
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
            <textarea className="w-full min-h-[160px] bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500" value={editingEntry.content} onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingEntry(null)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button type="button" onClick={() => { updateEntry(editingEntry.id, editingEntry); setEditingEntry(null); }} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white">保存</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">导入为角色卡</h2>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">世界</label>
              <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={targetWorldId} onChange={(e) => setTargetWorldId(e.target.value)}>
                {worlds.length === 0 && <option value="">（请先创建世界）</option>}
                {worlds.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">角色名</label>
              <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="可留空，使用 AI 输出中的 name" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button type="button" onClick={handleImportCard} disabled={!charsLoaded || !targetWorldId} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white disabled:opacity-40">确认导入</button>
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
