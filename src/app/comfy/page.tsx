"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCharacters } from "@/hooks/useCharacters";
import {
  ComfyParams,
  ComfySettings,
  ComfyWorkflowTemplate,
  DEFAULT_SAMPLERS,
  DEFAULT_SCHEDULERS,
  PLACEHOLDERS,
  applyPlaceholders,
  comfyCheckConnection,
  comfyImageUrl,
  comfyQueuePrompt,
  comfyWaitForImages,
  defaultParams,
  defaultSettings,
  detectPlaceholders,
  loadParams,
  loadSettings,
  loadWorkflows,
  normalizeWorkflowUpload,
  saveParams,
  saveSettings,
  saveWorkflows,
} from "@/lib/comfyConfig";

function newId() {
  return crypto.randomUUID();
}

export default function ComfyPage() {
  const { characters, loaded: charsLoaded } = useCharacters();

  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<ComfySettings>(defaultSettings());
  const [workflows, setWorkflows] = useState<ComfyWorkflowTemplate[]>([]);
  const [params, setParams] = useState<ComfyParams>(defaultParams());

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

  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = loadSettings();
    const w = loadWorkflows();
    const p = loadParams();
    setSettings(s);
    setWorkflows(w);
    setParams(p);
    if (!s.activeWorkflowId && w[0]) {
      const next = { ...s, activeWorkflowId: w[0].id };
      setSettings(next);
      saveSettings(next);
    }
    setReady(true);
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

  const persistSettings = (s: ComfySettings) => {
    setSettings(s);
    saveSettings(s);
  };
  const persistParams = (p: ComfyParams) => {
    setParams(p);
    saveParams(p);
  };
  const persistWorkflows = (list: ComfyWorkflowTemplate[]) => {
    setWorkflows(list);
    saveWorkflows(list);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnMsg("");
    try {
      const ver = await comfyCheckConnection(settings.baseUrl);
      setConnMsg(`已连接 · ${ver}`);
    } catch (e) {
      setConnMsg(e instanceof Error ? e.message : "连接失败（请确认 ComfyUI 已开 CORS）");
    } finally {
      setConnecting(false);
    }
  };

  const handleUploadWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const normalized = normalizeWorkflowUpload(String(reader.result || ""));
        const name = file.name.replace(/\.json$/i, "") || "工作流";
        setWfName(name);
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
    try {
      JSON.parse(wfRaw);
    } catch {
      showToast("JSON 无效");
      return;
    }
    const now = new Date().toISOString();
    if (wfEditingId) {
      const next = workflows.map((w) =>
        w.id === wfEditingId
          ? { ...w, name: wfName.trim() || w.name, workflow: wfRaw, updatedAt: now }
          : w
      );
      persistWorkflows(next);
    } else {
      const tpl: ComfyWorkflowTemplate = {
        id: newId(),
        name: wfName.trim() || "工作流",
        workflow: wfRaw,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...workflows, tpl];
      persistWorkflows(next);
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

  const handleGenerate = async () => {
    if (!activeWf) {
      setError("请先上传并选择工作流");
      return;
    }
    setError("");
    setStatus("提交到 ComfyUI…");
    setGenerating(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const seedUsed =
        params.seed < 0 ? Math.floor(Math.random() * 2 ** 32) : Math.floor(params.seed);
      const promptGraph = applyPlaceholders(activeWf.workflow, {
        ...params,
        seed: seedUsed,
      });
      setLastSeed(seedUsed);

      const { prompt_id } = await comfyQueuePrompt(settings.baseUrl, promptGraph);
      setStatus(`排队中 · ${prompt_id.slice(0, 8)}…`);

      const outs = await comfyWaitForImages(settings.baseUrl, prompt_id, {
        signal: ac.signal,
      });
      if (!outs.length) {
        setStatus("完成，但未找到输出图片节点");
        showToast("无图片输出");
      } else {
        const urls = outs.map((img) => comfyImageUrl(settings.baseUrl, img));
        setImages((prev) => [...urls, ...prev].slice(0, 40));
        setStatus(`完成 · ${outs.length} 张`);
        showToast("生成完成");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setStatus("已取消");
      } else {
        setError(e instanceof Error ? e.message : "生成失败");
        setStatus("");
      }
    } finally {
      setGenerating(false);
    }
  };

  const applyCharPrompt = (text: string) => {
    if (importMode === "replace") {
      persistParams({ ...params, prompt: text });
    } else {
      const next = params.prompt.trim()
        ? `${params.prompt.trim()}, ${text}`
        : text;
      persistParams({ ...params, prompt: next });
    }
    setImportCharOpen(false);
    showToast("已导入提示词");
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
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/" className="text-neutral-500 hover:text-white text-sm">
              ← Worlds
            </Link>
            <h1 className="text-2xl font-bold text-white mt-1">ComfyUI 生成</h1>
            <p className="text-neutral-500 text-sm mt-1">
              上传 API 格式工作流，用占位符注入参数。界面参考 A1111。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500 min-w-[200px]"
              value={settings.baseUrl}
              onChange={(e) =>
                persistSettings({ ...settings, baseUrl: e.target.value })
              }
              placeholder="http://127.0.0.1:8188"
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="px-3 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              {connecting ? "连接中…" : "测试连接"}
            </button>
            {connMsg && (
              <span className="text-xs text-neutral-500 max-w-[220px] truncate">
                {connMsg}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-3">
            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-neutral-200">正面提示词</label>
                <button
                  type="button"
                  onClick={() => {
                    if (characters[0] && !importCharId) setImportCharId(characters[0].id);
                    setImportCharOpen(true);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-purple-700/60 text-purple-300 hover:bg-purple-950/30"
                >
                  导入角色卡提示词
                </button>
              </div>
              <textarea
                className="w-full min-h-[120px] bg-[#0c0c0c] border border-neutral-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none text-neutral-200 resize-y"
                value={params.prompt}
                onChange={(e) => persistParams({ ...params, prompt: e.target.value })}
                placeholder="masterpiece, best quality, …"
              />
            </section>

            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-2">
              <label className="text-sm font-medium text-neutral-200">负面提示词</label>
              <textarea
                className="w-full min-h-[80px] bg-[#0c0c0c] border border-neutral-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none text-neutral-200 resize-y"
                value={params.negative_prompt}
                onChange={(e) => persistParams({ ...params, negative_prompt: e.target.value })}
              />
            </section>

            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">采样</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Sampling Steps</label>
                  <input type="number" min={1} max={150} className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.steps} onChange={(e) => persistParams({ ...params, steps: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">CFG Scale</label>
                  <input type="number" min={1} max={30} step={0.5} className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.cfg_scale} onChange={(e) => persistParams({ ...params, cfg_scale: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Sampler</label>
                  <select className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.sampler_name} onChange={(e) => persistParams({ ...params, sampler_name: e.target.value })}>
                    {!DEFAULT_SAMPLERS.includes(params.sampler_name) && <option value={params.sampler_name}>{params.sampler_name}</option>}
                    {DEFAULT_SAMPLERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Scheduler</label>
                  <select className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.scheduler} onChange={(e) => persistParams({ ...params, scheduler: e.target.value })}>
                    {!DEFAULT_SCHEDULERS.includes(params.scheduler) && <option value={params.scheduler}>{params.scheduler}</option>}
                    {DEFAULT_SCHEDULERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">
                    Seed（-1 随机）
                    {lastSeed != null && <span className="ml-2 text-neutral-600">上次: {lastSeed}</span>}
                  </label>
                  <div className="flex gap-2">
                    <input type="number" className="flex-1 bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500 font-mono"
                      value={params.seed} onChange={(e) => persistParams({ ...params, seed: Number(e.target.value) })} />
                    <button type="button" onClick={() => persistParams({ ...params, seed: -1 })} className="px-2 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:bg-neutral-800">随机</button>
                    {lastSeed != null && (
                      <button type="button" onClick={() => persistParams({ ...params, seed: lastSeed })} className="px-2 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:bg-neutral-800" title="使用上次种子">复用</button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">尺寸 / 模型</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Width</label>
                  <input type="number" step={8} min={64} max={4096} className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.width} onChange={(e) => persistParams({ ...params, width: Number(e.target.value) || 512 })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Height</label>
                  <input type="number" step={8} min={64} max={4096} className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                    value={params.height} onChange={(e) => persistParams({ ...params, height: Number(e.target.value) || 768 })} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">Checkpoint (%MODEL_NAME%)</label>
                  <input className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500 font-mono"
                    value={params.MODEL_NAME} onChange={(e) => persistParams({ ...params, MODEL_NAME: e.target.value })} placeholder="model.safetensors" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">VAE (%vae%)</label>
                  <input className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500 font-mono"
                    value={params.vae} onChange={(e) => persistParams({ ...params, vae: e.target.value })} placeholder="可选" />
                </div>
              </div>
            </section>

            <div className="flex gap-2">
              {!generating ? (
                <button type="button" onClick={handleGenerate} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm shadow-lg shadow-purple-900/30">Generate</button>
              ) : (
                <button type="button" onClick={() => abortRef.current?.abort()} className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-medium text-sm">Interrupt</button>
              )}
            </div>
            {status && <p className="text-xs text-neutral-500 text-center">{status}</p>}
            {error && <p className="text-xs text-rose-400 text-center break-all">{error}</p>}
          </div>

          <div className="lg:col-span-7 space-y-3">
            <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">工作流</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs rounded-lg border border-purple-700/60 text-purple-300 hover:bg-purple-950/30">上传工作流 JSON</button>
                  <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleUploadWorkflow} />
                </div>
              </div>

              {workflows.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 text-center">
                  尚未上传工作流。请从 ComfyUI 导出 API 格式 JSON，并把需要替换的值改成占位符（如 <code className="text-purple-300">%prompt%</code>）。
                </p>
              ) : (
                <div className="space-y-2">
                  <select className="w-full bg-[#0c0c0c] border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                    value={activeWf?.id || ""} onChange={(e) => persistSettings({ ...settings, activeWorkflowId: e.target.value })}>
                    {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                      if (!activeWf) return;
                      setWfEditingId(activeWf.id); setWfName(activeWf.name); setWfRaw(activeWf.workflow); setWfEditorOpen(true);
                    }} className="px-2.5 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-300">编辑</button>
                    <button type="button" onClick={() => activeWf && deleteWorkflow(activeWf.id)} className="px-2.5 py-1 text-xs border border-rose-900/40 rounded-lg text-rose-400">删除</button>
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
                <input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} />
                追加到正面提示词
              </label>
              <label className="flex items-center gap-1.5 text-neutral-300">
                <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
                替换正面提示词
              </label>
            </div>
            <div className="space-y-2">
              {!importCharId ? (
                <p className="text-sm text-neutral-500">请选择角色</p>
              ) : charPrompts.length === 0 ? (
                <p className="text-sm text-neutral-500">该角色没有保存的外观提示词（可在角色外观生成器导入）</p>
              ) : (
                charPrompts.map((p) => (
                  <button key={p.id} type="button" onClick={() => applyCharPrompt(p.text)}
                    className="w-full text-left p-3 rounded-lg border border-neutral-700 hover:border-purple-600 bg-[#0c0c0c] space-y-1">
                    <div className="text-xs text-purple-300">{p.label || "提示词"}</div>
                    <div className="text-xs text-neutral-400 font-mono line-clamp-3 break-all">{p.text}</div>
                  </button>
                ))
              )}
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
              将需要动态替换的字段改成占位符，例如把提示词节点里的文本换成 <code className="text-purple-300">%prompt%</code>。
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-white text-black text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}
