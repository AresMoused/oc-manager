"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCharacters } from "@/hooks/useCharacters";
import {
  ComfyParams, ComfyPromptPreset, ComfySettings, ComfyWorkflowTemplate,
  DEFAULT_SAMPLERS, DEFAULT_SCHEDULERS, PLACEHOLDERS,
  applyPlaceholders, comfyCheckConnection, comfyImageUrl, comfyQueuePrompt,
  comfyWaitForImages, composePositivePrompt, defaultParams, defaultSettings,
  detectPlaceholders, loadParams, loadPromptPresets, loadSettings, loadWorkflows,
  normalizeWorkflowUpload, saveParams, savePromptPresets, saveSettings, saveWorkflows,
} from "@/lib/comfyConfig";
import type { BuilderData } from "@/lib/promptBuilder";
import { loadLexiconBuilder, rollRandomCharacter as rollLexicon } from "@/lib/comfyLexicon";

function newId() { return crypto.randomUUID(); }

const RANDOM_LOCK_KEY = "oc-comfy-random-char-lock";
const BATCH_KEY = "oc-comfy-batch-count";

export default function ComfyView() {
  const { characters, loaded: charsLoaded } = useCharacters();
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<ComfySettings>(defaultSettings());
  const [workflows, setWorkflows] = useState<ComfyWorkflowTemplate[]>([]);
  const [params, setParams] = useState<ComfyParams>(defaultParams());
  const [presets, setPresets] = useState<ComfyPromptPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);
  const [connMsg, setConnMsg] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [importCharOpen, setImportCharOpen] = useState(false);
  const [importCharId, setImportCharId] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("append");
  const [wfEditorOpen, setWfEditorOpen] = useState(false);
  const [wfName, setWfName] = useState("");
  const [wfRaw, setWfRaw] = useState("");
  const [wfEditingId, setWfEditingId] = useState<string | null>(null);

  const [batchCount, setBatchCount] = useState(1);
  const [builder, setBuilder] = useState<BuilderData | null>(null);
  const [randomEnabled, setRandomEnabled] = useState(true);
  const [randomLocked, setRandomLocked] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = loadSettings();
    const w = loadWorkflows();
    setSettings(s);
    setWorkflows(w);
    setParams(loadParams());
    setPresets(loadPromptPresets());
    if (!s.activeWorkflowId && w[0]) {
      const next = { ...s, activeWorkflowId: w[0].id };
      setSettings(next);
      saveSettings(next);
    }
    try {
      const b = Number(localStorage.getItem(BATCH_KEY) || "1");
      if (b >= 1 && b <= 20) setBatchCount(b);
    } catch { /* ignore */ }
    setRandomLocked(localStorage.getItem(RANDOM_LOCK_KEY) === "1");

    loadLexiconBuilder().then((s) => setBuilder(s)).finally(() => setReady(true));
    const reloadBuilder = () => { void loadLexiconBuilder().then((s) => { if (s) setBuilder(s); }); };
    window.addEventListener("focus", reloadBuilder);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reloadBuilder();
    });
    return () => {
      window.removeEventListener("focus", reloadBuilder);
    };
  }, []);

  const activeWf = useMemo(
    () => workflows.find((w) => w.id === settings.activeWorkflowId) || workflows[0],
    [workflows, settings.activeWorkflowId]
  );
  const detected = useMemo(
    () => (activeWf ? detectPlaceholders(activeWf.workflow) : []),
    [activeWf]
  );
  const charPrompts = useMemo(() => {
    const c = characters.find((x) => x.id === importCharId);
    return c?.prompts || [];
  }, [characters, importCharId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  const persistSettings = (s: ComfySettings) => { setSettings(s); saveSettings(s); };
  const persistParams = (p: ComfyParams) => { setParams(p); saveParams(p); };
  const persistWorkflows = (list: ComfyWorkflowTemplate[]) => { setWorkflows(list); saveWorkflows(list); };
  const persistPresets = (list: ComfyPromptPreset[]) => { setPresets(list); savePromptPresets(list); };

  const setBatch = (n: number) => {
    const v = Math.min(20, Math.max(1, Math.floor(n) || 1));
    setBatchCount(v);
    try { localStorage.setItem(BATCH_KEY, String(v)); } catch { /* ignore */ }
  };

  const toggleRandomLock = () => {
    setRandomLocked((prev) => {
      const next = !prev;
      localStorage.setItem(RANDOM_LOCK_KEY, next ? "1" : "0");
      return next;
    });
  };

  const rollRandomCharacter = useCallback((data: BuilderData | null): string | null => rollLexicon(data), []);

  const handleRandomNow = () => {
    const text = rollRandomCharacter(builder);
    if (!text) {
      showToast("词库为空：请先打开「角色外观生成器」并启动列表");
      return;
    }
    persistParams({ ...params, prompt_character: text });
    showToast("已随机生成角色提示词");
  };

  const handleConnect = async () => {
    setConnecting(true); setConnMsg("");
    try {
      const ver = await comfyCheckConnection(settings.baseUrl);
      setConnMsg(`已连接 · ${ver}`);
    } catch (e) {
      setConnMsg(e instanceof Error ? e.message : "连接失败（请确认 ComfyUI 已开 CORS）");
    } finally { setConnecting(false); }
  };

  const handleUploadWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const normalized = normalizeWorkflowUpload(String(reader.result || ""));
        setWfName(file.name.replace(/\.json$/i, "") || "工作流");
        setWfRaw(normalized);
        setWfEditingId(null);
        setWfEditorOpen(true);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "工作流解析失败");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const saveWorkflowFromEditor = () => {
    try { JSON.parse(wfRaw); } catch { showToast("JSON 无效"); return; }
    const now = new Date().toISOString();
    if (wfEditingId) {
      persistWorkflows(workflows.map((w) =>
        w.id === wfEditingId
          ? { ...w, name: wfName.trim() || w.name, workflow: wfRaw, updatedAt: now }
          : w
      ));
    } else {
      const tpl: ComfyWorkflowTemplate = {
        id: newId(), name: wfName.trim() || "工作流", workflow: wfRaw, createdAt: now, updatedAt: now,
      };
      persistWorkflows([...workflows, tpl]);
      persistSettings({ ...settings, activeWorkflowId: tpl.id });
    }
    setWfEditorOpen(false);
    showToast("工作流已保存");
  };

  const deleteWorkflow = (id: string) => {
    if (!confirm("删除此工作流？")) return;
    const next = workflows.filter((w) => w.id !== id);
    persistWorkflows(next);
    if (settings.activeWorkflowId === id) {
      persistSettings({ ...settings, activeWorkflowId: next[0]?.id || "" });
    }
  };

  const runOneGeneration = async (
    p: ComfyParams,
    signal: AbortSignal
  ): Promise<string[]> => {
    if (!activeWf) throw new Error("请先上传并选择工作流");
    const seedUsed = p.seed < 0 ? Math.floor(Math.random() * 2 ** 32) : Math.floor(p.seed);
    setLastSeed(seedUsed);
    const promptGraph = applyPlaceholders(activeWf.workflow, { ...p, seed: seedUsed });
    const { prompt_id } = await comfyQueuePrompt(settings.baseUrl, promptGraph);
    const outs = await comfyWaitForImages(settings.baseUrl, prompt_id, { signal });
    return outs.map((img) => comfyImageUrl(settings.baseUrl, img));
  };

  const handleGenerate = async () => {
    if (!activeWf) {
      setError("请先上传并选择工作流");
      return;
    }
    setError("");
    setGenerating(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const total = Math.min(20, Math.max(1, batchCount));
    let currentParams = { ...params };
    let collected: string[] = [];

    try {
      for (let i = 0; i < total; i++) {
        if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");

        if (randomEnabled && !randomLocked) {
          const rolled = rollRandomCharacter(builder);
          if (rolled) {
            currentParams = { ...currentParams, prompt_character: rolled };
            setParams(currentParams);
            saveParams(currentParams);
          }
        }

        setStatus(total > 1 ? `生成中 ${i + 1}/${total}…` : "提交到 ComfyUI…");
        const urls = await runOneGeneration(currentParams, ac.signal);
        if (urls.length) {
          collected = [...urls, ...collected];
          setImages((prev) => [...urls, ...prev].slice(0, 60));
        }
      }
      setStatus(total > 1 ? `完成 · 共 ${total} 次 · ${collected.length} 张` : `完成 · ${collected.length} 张`);
      showToast(total > 1 ? `批量完成 ${total} 次` : "生成完成");
      if (!collected.length) showToast("无图片输出");
    } catch (e) {
      if ((e as Error).name === "AbortError") setStatus("已取消");
      else { setError(e instanceof Error ? e.message : "生成失败"); setStatus(""); }
    } finally {
      setGenerating(false);
    }
  };

  const applyCharPrompt = (text: string) => {
    if (importMode === "replace") persistParams({ ...params, prompt_character: text });
    else {
      const next = params.prompt_character.trim()
        ? `${params.prompt_character.trim()}, ${text}` : text;
      persistParams({ ...params, prompt_character: next });
    }
    setImportCharOpen(false);
    showToast("已导入角色提示词");
  };

  const saveCurrentAsPreset = () => {
    const name = presetName.trim() || `预设 ${presets.length + 1}`;
    const now = new Date().toISOString();
    persistPresets([...presets, {
      id: newId(), name,
      prompt_prefix: params.prompt_prefix,
      prompt_character: params.prompt_character,
      prompt_suffix: params.prompt_suffix,
      negative_prompt: params.negative_prompt,
      createdAt: now, updatedAt: now,
    }]);
    setPresetName("");
    showToast("预设已保存");
  };

  const applyPreset = (pr: ComfyPromptPreset, withNeg: boolean) => {
    persistParams({
      ...params,
      prompt_prefix: pr.prompt_prefix,
      prompt_character: pr.prompt_character,
      prompt_suffix: pr.prompt_suffix,
      ...(withNeg && pr.negative_prompt != null ? { negative_prompt: pr.negative_prompt } : {}),
    });
    setPresetOpen(false);
    showToast(`已应用预设：${pr.name}`);
  };

  const deletePreset = (id: string) => {
    if (!confirm("删除此预设？")) return;
    persistPresets(presets.filter((x) => x.id !== id));
  };

  const combinedPreview = composePositivePrompt(params);
  const inp = "w-full bg-[#0c0c0c] border border-neutral-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none text-neutral-200";
  const card = "bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-3";
  const sectionCount = builder?.sections?.length ?? 0;

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-neutral-500 hover:text-white text-sm">← Worlds</Link>
            <h1 className="text-2xl font-bold text-white mt-1">抽卡姬</h1>
            <p className="text-neutral-500 text-sm mt-1">上传 API 格式工作流，用占位符注入参数。界面参考 A1111。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500 min-w-[200px]"
              value={settings.baseUrl} onChange={(e) => persistSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="http://127.0.0.1:8188" />
            <button type="button" onClick={handleConnect} disabled={connecting}
              className="px-3 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
              {connecting ? "连接中…" : "测试连接"}
            </button>
            {connMsg && <span className="text-xs text-neutral-500 max-w-[220px] truncate">{connMsg}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-3">
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-200">正面提示词</h3>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setPresetOpen(true)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800">
                    预设 ({presets.length})
                  </button>
                  <button type="button" onClick={() => {
                    if (characters[0] && !importCharId) setImportCharId(characters[0].id);
                    setImportCharOpen(true);
                  }} className="text-xs px-2.5 py-1 rounded-lg border border-purple-700/60 text-purple-300 hover:bg-purple-950/30">
                    导入角色卡提示词
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">前置正面提示词</label>
                <textarea className={`${inp} min-h-[56px] resize-y`} value={params.prompt_prefix}
                  onChange={(e) => persistParams({ ...params, prompt_prefix: e.target.value })}
                  placeholder="masterpiece, best quality, …" />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="text-xs text-purple-300/90">角色提示词</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer select-none">
                      <input type="checkbox" checked={randomEnabled}
                        onChange={(e) => setRandomEnabled(e.target.checked)}
                        className="rounded border-neutral-600" />
                      随机角色
                    </label>
                    <button type="button" onClick={toggleRandomLock}
                      title={randomLocked ? "已锁定：生成时不更换角色提示词" : "未锁定：每次生成会重新随机"}
                      className={`text-[11px] px-2 py-0.5 rounded border ${
                        randomLocked
                          ? "border-amber-600/60 text-amber-300 bg-amber-950/30"
                          : "border-neutral-600 text-neutral-400 hover:bg-neutral-800"
                      }`}>
                      {randomLocked ? "🔒 已锁定" : "🔓 未锁定"}
                    </button>
                    <button type="button" onClick={handleRandomNow}
                      disabled={!sectionCount}
                      className="text-[11px] px-2 py-0.5 rounded border border-purple-700/50 text-purple-300 hover:bg-purple-950/30 disabled:opacity-40">
                      🎲 立即随机
                    </button>
                    <Link
                      href="/generator"
                      className="text-[11px] px-2 py-0.5 rounded border border-sky-700/50 text-sky-300 hover:bg-sky-950/30"
                      title="在角色外观生成器中调整词库与选项"
                    >
                      ✎ 去外观生成器修改
                    </Link>
                  </div>
                </div>
                <textarea className={`${inp} min-h-[88px] resize-y border-purple-800/40`} value={params.prompt_character}
                  onChange={(e) => persistParams({ ...params, prompt_character: e.target.value })}
                  placeholder="从角色卡导入，或开启随机角色 / 立即随机…" />
                <p className="text-[10px] text-neutral-600 mt-1">
                  使用「角色外观生成器」已启用的 CDN 词库
                  {sectionCount > 0 ? `（${sectionCount} 个分区）` : "（尚未加载，请先打开生成器并同步）"}。
                  开启随机且未锁定时，每次 Generate 会自动换一条。
                  在外观生成器组合好后可点「导入到抽卡姬」写回本栏。
                </p>
              </div>

              <div>
                <label className="text-xs text-neutral-500 block mb-1">后置正面提示词</label>
                <textarea className={`${inp} min-h-[56px] resize-y`} value={params.prompt_suffix}
                  onChange={(e) => persistParams({ ...params, prompt_suffix: e.target.value })}
                  placeholder="optional quality tags, style…" />
              </div>
              {combinedPreview && (
                <div className="pt-1 border-t border-neutral-800">
                  <div className="text-[10px] text-neutral-600 mb-1">组合预览 → %prompt%</div>
                  <p className="text-[11px] text-neutral-500 font-mono leading-relaxed break-all line-clamp-3">{combinedPreview}</p>
                </div>
              )}
            </section>

            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-2">
              <label className="text-sm font-medium text-neutral-200">负面提示词</label>
              <textarea className={`${inp} min-h-[80px] resize-y`} value={params.negative_prompt}
                onChange={(e) => persistParams({ ...params, negative_prompt: e.target.value })} />
            </section>

            <section className={card}>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">采样</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Sampling Steps</label>
                  <input type="number" min={1} max={150} className={inp} value={params.steps}
                    onChange={(e) => persistParams({ ...params, steps: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">CFG Scale</label>
                  <input type="number" min={1} max={30} step={0.5} className={inp} value={params.cfg_scale}
                    onChange={(e) => persistParams({ ...params, cfg_scale: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Sampler</label>
                  <select className={inp} value={params.sampler_name}
                    onChange={(e) => persistParams({ ...params, sampler_name: e.target.value })}>
                    {!DEFAULT_SAMPLERS.includes(params.sampler_name) && <option value={params.sampler_name}>{params.sampler_name}</option>}
                    {DEFAULT_SAMPLERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Scheduler</label>
                  <select className={inp} value={params.scheduler}
                    onChange={(e) => persistParams({ ...params, scheduler: e.target.value })}>
                    {!DEFAULT_SCHEDULERS.includes(params.scheduler) && <option value={params.scheduler}>{params.scheduler}</option>}
                    {DEFAULT_SCHEDULERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">
                    Seed（-1 随机）{lastSeed != null && <span className="ml-2 text-neutral-600">上次: {lastSeed}</span>}
                  </label>
                  <div className="flex gap-2">
                    <input type="number" className={`${inp} flex-1 font-mono`} value={params.seed}
                      onChange={(e) => persistParams({ ...params, seed: Number(e.target.value) })} />
                    <button type="button" onClick={() => persistParams({ ...params, seed: -1 })}
                      className="px-2 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:bg-neutral-800">随机</button>
                    {lastSeed != null && (
                      <button type="button" onClick={() => persistParams({ ...params, seed: lastSeed })}
                        className="px-2 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:bg-neutral-800">复用</button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className={card}>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">尺寸 / 模型</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Width</label>
                  <input type="number" step={8} min={64} max={4096} className={inp} value={params.width}
                    onChange={(e) => persistParams({ ...params, width: Number(e.target.value) || 512 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Height</label>
                  <input type="number" step={8} min={64} max={4096} className={inp} value={params.height}
                    onChange={(e) => persistParams({ ...params, height: Number(e.target.value) || 768 })} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">Checkpoint (%MODEL_NAME%)</label>
                  <input className={`${inp} font-mono`} value={params.MODEL_NAME}
                    onChange={(e) => persistParams({ ...params, MODEL_NAME: e.target.value })} placeholder="model.safetensors" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">VAE (%vae%)</label>
                  <input className={`${inp} font-mono`} value={params.vae}
                    onChange={(e) => persistParams({ ...params, vae: e.target.value })} placeholder="可选" />
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <section className="bg-[#141414] border border-purple-900/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-24">
                  <label className="text-xs text-neutral-500 block mb-1">批量次数</label>
                  <input type="number" min={1} max={20} className={inp}
                    value={batchCount}
                    onChange={(e) => setBatch(Number(e.target.value))}
                    disabled={generating} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  {!generating ? (
                    <button type="button" onClick={handleGenerate}
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm shadow-lg shadow-purple-900/30">
                      {batchCount > 1 ? `Generate × ${batchCount}` : "Generate"}
                    </button>
                  ) : (
                    <button type="button" onClick={() => abortRef.current?.abort()}
                      className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-medium text-sm">
                      Interrupt
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                {randomEnabled && (
                  <span>
                    随机角色：{randomLocked ? "已锁定当前提示词" : "每次生成重新随机"}
                  </span>
                )}
                {status && <span className="text-neutral-400">{status}</span>}
                {error && <span className="text-rose-400 break-all">{error}</span>}
              </div>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">工作流</h3>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 text-xs rounded-lg border border-purple-700/60 text-purple-300 hover:bg-purple-950/30">上传工作流 JSON</button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleUploadWorkflow} />
              </div>
              {workflows.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 text-center">
                  尚未上传工作流。请从 ComfyUI 导出 API 格式 JSON，并把需要替换的值改成占位符（如 <code className="text-purple-300">%prompt%</code>）。
                </p>
              ) : (
                <div className="space-y-2">
                  <select className={inp} value={activeWf?.id || ""}
                    onChange={(e) => persistSettings({ ...settings, activeWorkflowId: e.target.value })}>
                    {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                      if (!activeWf) return;
                      setWfEditingId(activeWf.id); setWfName(activeWf.name); setWfRaw(activeWf.workflow); setWfEditorOpen(true);
                    }} className="px-2.5 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-300">编辑</button>
                    <button type="button" onClick={() => activeWf && deleteWorkflow(activeWf.id)}
                      className="px-2.5 py-1 text-xs border border-rose-900/40 rounded-lg text-rose-400">删除</button>
                  </div>
                  {detected.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-neutral-500 w-full mb-0.5">检测到的占位符：</span>
                      {detected.map((p) => (
                        <span key={p} className={`text-[11px] px-2 py-0.5 rounded border font-mono ${
                          (PLACEHOLDERS as readonly string[]).includes(p)
                            ? "border-purple-800/50 text-purple-300 bg-purple-950/20"
                            : "border-amber-800/40 text-amber-300/80"
                        }`}>%{p}%</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    支持：%seed% %steps% %cfg_scale% %sampler_name% %width% %height% %prompt% %negative_prompt% %MODEL_NAME% %scheduler% %vae%
                  </p>
                </div>
              )}
            </section>

            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 min-h-[320px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-200">输出</h3>
                {images.length > 0 && (
                  <button type="button" onClick={() => setImages([])} className="text-xs text-neutral-500 hover:text-white">清空</button>
                )}
              </div>
              {images.length === 0 ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-neutral-800 rounded-xl text-neutral-600 text-sm">生成结果将显示在这里</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((url, i) => (
                    <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer"
                      className="block aspect-[3/4] rounded-lg overflow-hidden border border-neutral-800 bg-black group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`out-${i}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />

      {importCharOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">导入角色卡提示词</h2>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">角色</label>
              <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                value={importCharId} onChange={(e) => setImportCharId(e.target.value)}>
                <option value="">选择角色…</option>
                {charsLoaded && characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.world ? ` · ${c.world}` : ""}{c.prompts?.length ? ` (${c.prompts.length})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5 text-neutral-300">
                <input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} />追加到角色提示词
              </label>
              <label className="flex items-center gap-1.5 text-neutral-300">
                <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />替换角色提示词
              </label>
            </div>
            <div className="space-y-2">
              {!importCharId ? (
                <p className="text-sm text-neutral-500">请选择角色</p>
              ) : charPrompts.length === 0 ? (
                <p className="text-sm text-neutral-500">该角色没有保存的外观提示词（可在角色外观生成器导入）</p>
              ) : charPrompts.map((p) => (
                <button key={p.id} type="button" onClick={() => applyCharPrompt(p.text)}
                  className="w-full text-left p-3 rounded-lg border border-neutral-700 hover:border-purple-600 bg-[#0c0c0c] space-y-1">
                  <div className="text-xs text-purple-300">{p.label || "提示词"}</div>
                  <div className="text-xs text-neutral-400 font-mono line-clamp-3 break-all">{p.text}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setImportCharOpen(false)} className="px-4 py-2 text-sm text-neutral-400">关闭</button>
            </div>
          </div>
        </div>
      )}

      {wfEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-3 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold text-white">{wfEditingId ? "编辑工作流" : "保存工作流"}</h2>
            <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
              value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="工作流名称" />
            <p className="text-xs text-neutral-500">
              将需要动态替换的字段改成占位符，例如 <code className="text-purple-300">%prompt%</code>。
            </p>
            <textarea className="flex-1 min-h-[280px] w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-purple-500 text-neutral-300"
              value={wfRaw} onChange={(e) => setWfRaw(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.map((p) => (
                <button key={p} type="button" onClick={() => setWfRaw((prev) => prev + `%${p}%`)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-purple-300 font-mono">%{p}%</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setWfEditorOpen(false)} className="px-4 py-2 text-sm text-neutral-400">取消</button>
              <button type="button" onClick={saveWorkflowFromEditor} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white">保存</button>
            </div>
          </div>
        </div>
      )}

      {presetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">正面提示词预设</h2>
            <div className="space-y-2 p-3 rounded-lg border border-neutral-800 bg-[#0c0c0c]">
              <div className="text-xs text-neutral-400">保存当前三段提示词为预设</div>
              <div className="flex gap-2">
                <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="预设名称" />
                <button type="button" onClick={saveCurrentAsPreset}
                  className="px-3 py-2 text-sm rounded-lg bg-purple-600 text-white whitespace-nowrap">保存</button>
              </div>
              <p className="text-[11px] text-neutral-600 line-clamp-2 font-mono">{combinedPreview || "（当前为空）"}</p>
            </div>
            <div className="space-y-2">
              {presets.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">暂无预设</p>
              ) : presets.map((pr) => (
                <div key={pr.id} className="p-3 rounded-lg border border-neutral-700 bg-[#0c0c0c] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white font-medium">{pr.name}</span>
                    <button type="button" onClick={() => deletePreset(pr.id)} className="text-xs text-rose-400 hover:text-rose-300">删除</button>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-mono line-clamp-2 break-all">{composePositivePrompt(pr)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => applyPreset(pr, false)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-purple-700/50 text-purple-300 hover:bg-purple-950/30">应用正面</button>
                    <button type="button" onClick={() => applyPreset(pr, true)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800">应用正面+负面</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setPresetOpen(false)} className="px-4 py-2 text-sm text-neutral-400">关闭</button>
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
