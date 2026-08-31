"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { completeChat, fetchModels } from "@/lib/aiConfig";
import {
  type ApplyPatch,
  type ChatPresetFile,
  type ChatTurn,
  APPLY_INSTRUCTION,
  extractApplyPatches,
  fieldsFromPatch,
  loadChatApiConfig,
  loadChatParams,
  loadChatPreset,
  resolveApplyTarget,
  saveChatApiConfig,
  saveChatParams,
  saveChatPreset,
} from "@/lib/characterChat";
import {
  defaultZhiPersona,
  emptyZhiThread,
  loadZhiPersona,
  loadZhiThreads,
  pageHint,
  saveZhiPersona,
  saveZhiThreads,
  type ZhiPersona,
  type ZhiThread,
} from "@/lib/zhiHuiJi";
import {
  TOOL_INSTRUCTION,
  extractSystemQueries,
  runQueries,
  stripSystemQueries,
  type ZhiTask,
} from "@/lib/zhiTools";
import { useCharacters } from "@/hooks/useCharacters";
import ChatHtml from "@/components/ChatHtml";
import PresetEditor from "@/components/PresetEditor";
import type { Character, GalleryImage, StoredPrompt } from "@/lib/types";
import { useDockGeo } from "@/hooks/useDockGeo";

type Panel = "none" | "settings" | "history";
type Tab = "api" | "params" | "persona" | "preset" | "features";

export default function ZhiHuiJiDock() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { characters, updateCharacter, addTimelineEvent } = useCharacters();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [tab, setTab] = useState<Tab>("api");
  const [cfg, setCfg] = useState<AiApiConfig>(() => loadChatApiConfig());
  const [params, setParams] = useState<AiModelParams>(() => loadChatParams());
  const [persona, setPersona] = useState<ZhiPersona>(() => defaultZhiPersona());
  const [preset, setPreset] = useState<ChatPresetFile | null>(null);
  const [thread, setThread] = useState<ZhiThread>(() => emptyZhiThread());
  const [threads, setThreads] = useState<ZhiThread[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState<{ msgId: string; patches: ApplyPatch[] } | null>(null);
  const [task, setTask] = useState<ZhiTask | null>(null);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<ZhiTask | null>(null);
  const { panelRef, panelStyle, fabStyle, headerDrag, resizeHandle, fabDrag } = useDockGeo("oc-zhihuiji-geo-v1");

  useEffect(() => {
    setPersona(loadZhiPersona());
    setPreset(loadChatPreset());
    const store = loadZhiThreads();
    const cur = store.threads.find((t) => t.id === store.currentId) || store.threads[0];
    setThreads(store.threads);
    if (cur) setThread(cur);
  }, []);

  useEffect(() => {
    const store = { currentId: thread.id, threads: threads.some((t) => t.id === thread.id) ? threads.map((t) => (t.id === thread.id ? thread : t)) : [thread, ...threads] };
    saveZhiThreads(store);
    setThreads(store.threads);
  }, [thread]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [thread.messages, busy]);

  const ping = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2000);
  };
  const persistCfg = (n: AiApiConfig) => {
    setCfg(n);
    saveChatApiConfig(n);
  };
  const persistParams = (n: AiModelParams) => {
    setParams(n);
    saveChatParams(n);
  };

  const charId = pathname.match(/^\/character\/([^/]+)/)?.[1];
  const pageChar = charId ? characters.find((c) => c.id === charId) : undefined;
  const onShare = pathname.startsWith("/shared/");

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!cfg.apiKey.trim()) {
      setError("请先填 API");
      setPanel("settings");
      setTab("api");
      return;
    }
    setError("");
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      speakerName: "你",
      content: text,
      at: new Date().toISOString(),
    };
    const asstId = crypto.randomUUID();
    setThread((t) => ({
      ...t,
      title: t.messages.length ? t.title : text.slice(0, 18),
      messages: [
        ...t.messages,
        userTurn,
        { id: asstId, role: "assistant", speakerName: persona.name, content: "", at: new Date().toISOString() },
      ],
    }));
    setDraft("");
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const hist = [...thread.messages, userTurn].slice(-12);
    const sys = [
      persona.body,
      TOOL_INSTRUCTION,
      pageHint(pathname),
      pageChar ? `当前角色卡摘要：\n${pageChar.name} / ${pageChar.identity} / ${pageChar.story.slice(0, 500)}` : "",
      onShare ? "分享页：不要假设能写入对方卡，除非用户有编辑权并点了应用。" : "",
      !onShare ? APPLY_INSTRUCTION : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: sys },
        ...hist.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];
      let lastRaw = "";
      const allImages: { url: string; characterId?: string }[] = [];
      let lastCharId: string | undefined;
      for (let round = 0; round < 6; round++) {
        if (ac.signal.aborted) break;
        setStatus(round === 0 ? "" : `工具第 ${round} 轮…`);
        const raw = await completeChat({
          config: cfg,
          params,
          signal: ac.signal,
          logSource: "陪玩姬",
          logTitle: thread.title || "陪玩姬",
          messages,
          onDelta: (full) => {
            setThread((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === asstId ? { ...m, content: stripSystemQueries(full) || full } : m
              ),
            }));
          },
        });
        lastRaw = raw;
        const queries = extractSystemQueries(raw);
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === asstId ? { ...m, content: stripSystemQueries(raw) || raw } : m
          ),
        }));
        if (!queries.length) break;
        const result = await runQueries(queries, {
          characters,
          pageCharacter: pageChar,
          pathname,
          signal: ac.signal,
          task: taskRef.current,
          onTask: (t) => {
            taskRef.current = t;
            setTask(t);
          },
          onStatus: setStatus,
          onGoto: (path) => router.push(path),
          onPatchCharacter: onShare ? undefined : (cid, patch) => updateCharacter(cid, patch),
          logSource: "陪玩姬",
          lastUserLine: text,
          preferCharacter: pageChar,
        });
        lastCharId = result.characterId || lastCharId;
        for (const url of result.images) allImages.push({ url, characterId: result.characterId || lastCharId });
        messages.push({ role: "assistant", content: raw });
        messages.push({ role: "user", content: `【系统自动回复】\n${result.text}` });
      }
      const visible = stripSystemQueries(lastRaw) || lastRaw;
      setThread((t) => {
        let messagesNext = t.messages.map((m) => (m.id === asstId ? { ...m, content: visible } : m));
        for (const img of allImages) {
          messagesNext = [
            ...messagesNext,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              speakerName: persona.name,
              speakerId: img.characterId,
              content: "图",
              imageUrl: img.url,
              at: new Date().toISOString(),
            },
          ];
        }
        return { ...t, messages: messagesNext };
      });
      const patches = extractApplyPatches(lastRaw);
      if (patches.length) setPending({ msgId: asstId, patches });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const applyPatches = (patches: ApplyPatch[]) => {
    if (onShare) {
      ping("分享页请用角色对话窗，且需有编辑权");
      setPending(null);
      return;
    }
    for (const p of patches) {
      const target = resolveApplyTarget(p, characters, pageChar || characters[0] || ({ id: "", name: "", prompts: [] } as unknown as Character));
      if (!target?.id) continue;
      const fields = fieldsFromPatch(p);
      const patch: Partial<Character> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === "age") (patch as { age?: string | number }).age = v;
        else (patch as Record<string, unknown>)[k] = String(v);
      }
      if (p.addPrompt?.text) {
        const item: StoredPrompt = {
          id: crypto.randomUUID(),
          text: p.addPrompt.text,
          label: p.addPrompt.label || "陪玩姬",
          createdAt: new Date().toISOString(),
        };
        patch.prompts = [...(target.prompts || []), item];
      }
      if (Object.keys(patch).length) updateCharacter(target.id, patch);
      if (p.addTimeline?.title) {
        addTimelineEvent(target.id, {
          date: new Date().toISOString().slice(0, 10),
          title: p.addTimeline.title,
          description: p.addTimeline.description || "",
          importance: "normal",
        });
      }
    }
    setPending(null);
    ping("已应用");
  };

  const saveToGallery = async (url: string, characterId?: string) => {
    const id = characterId || pageChar?.id;
    const target = characters.find((c) => c.id === id);
    if (!target) {
      ping("不知道存进哪张卡，请在角色页再试");
      return;
    }
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const file = new File([blob], "gen.png", { type: blob.type || "image/png" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      const item: GalleryImage = { id: crypto.randomUUID(), url: data.url, caption: "陪玩姬生成" };
      updateCharacter(target.id, { gallery: [...(target.gallery || []), item] });
      ping(`已存进 ${target.name} 图库`);
    } catch (e) {
      ping(e instanceof Error ? e.message : "保存失败（Comfy 地址需允许跨域）");
    }
  };

  return (
    <>
      <button
        type="button"
        title="陪玩姬"
        className="fixed z-[70] w-14 h-14 rounded-full bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40 hover:bg-fuchsia-500 text-lg"
        style={fabStyle(56, { right: 20, bottom: 20 })}
        {...fabDrag(() => setOpen((v) => !v), 56)}
      >
        姬
      </button>
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[76] rounded-2xl border border-neutral-700 bg-[#121214]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
          style={panelStyle}
        >
          <div
            className="px-3 py-2 border-b border-neutral-800 flex items-center gap-1 cursor-grab active:cursor-grabbing"
            {...headerDrag}
          >
            <div className="w-7 h-7 rounded-full bg-fuchsia-800 text-white text-xs flex items-center justify-center">姬</div>
            <div className="flex-1 min-w-0 ml-1">
              <div className="text-sm text-white truncate">{persona.name}</div>
              <div className="text-[10px] text-neutral-500 truncate">
                {status || task?.title || thread.title}
              </div>
            </div>
            <button type="button" className="text-neutral-400 w-7 h-7" title="历史" onClick={() => setPanel(panel === "history" ? "none" : "history")}>🕒</button>
            <button type="button" className="text-neutral-400 w-7 h-7" title="新建" onClick={() => { setThread(emptyZhiThread()); setTask(null); taskRef.current = null; setPanel("none"); }}>🧹</button>
            <button type="button" className="text-neutral-400 w-7 h-7" title="设置" onClick={() => setPanel(panel === "settings" ? "none" : "settings")}>⚙</button>
            <button type="button" className="text-neutral-400 w-7 h-7" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="relative flex-1 min-h-0">
            <div ref={logRef} className="absolute inset-0 overflow-y-auto p-3 space-y-3 flex flex-col">
              {task && (
                <div className="text-[11px] border border-fuchsia-900/50 bg-fuchsia-950/30 rounded-xl px-2 py-1.5">
                  <div className="text-fuchsia-200 mb-1">{task.title}</div>
                  {task.steps.map((s, i) => (
                    <div key={i} className="text-neutral-400">
                      {s.status === "completed" ? "✓" : s.status === "failed" ? "✕" : s.status === "in_progress" ? "…" : "○"} {s.title}
                      {s.result ? ` · ${s.result}` : ""}
                    </div>
                  ))}
                </div>
              )}
              {thread.messages.length === 0 && (
                <div className="text-sm text-neutral-400 bg-[#1c1c20] border border-neutral-800 rounded-2xl px-3 py-2 max-w-[90%]">
                  你好，我是{persona.name}。可以查角色卡、按词库生图、改设定。和角色演戏请用「角色对话」。
                </div>
              )}
              {thread.messages.map((m) => {
                const mine = m.role === "user";
                return (
                  <div key={m.id} className={`flex gap-2 max-w-[90%] ${mine ? "self-end flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs ${mine ? "bg-purple-800" : "bg-fuchsia-800"}`}>
                      {mine ? "你" : "姬"}
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-sm border ${mine ? "bg-purple-600/20 border-purple-800/50 whitespace-pre-wrap" : "bg-[#1c1c20] border-neutral-800"}`}>
                      {m.imageUrl && (
                        <div className="mb-1">
                          <img src={m.imageUrl} alt="" className="max-h-48 rounded-lg" />
                          {!onShare && (
                            <button
                              type="button"
                              className="mt-1 text-[10px] text-fuchsia-300"
                              onClick={() => void saveToGallery(m.imageUrl!, m.speakerId)}
                            >
                              存进图库
                            </button>
                          )}
                        </div>
                      )}
                      {mine ? m.content : m.content === "图" && m.imageUrl ? null : <ChatHtml raw={m.content || (busy ? "…" : "")} regexes={preset?.regexes} />}
                      {!mine && pending?.msgId === m.id && (
                        <div className="mt-2 text-[11px]">
                          {pending.patches.map((p, i) => (
                            <div key={i} className="text-amber-200 mb-1">{p.note || p.characterName || "建议改卡"}</div>
                          ))}
                          <button type="button" className="px-2 py-0.5 rounded bg-purple-600 text-white mr-1" onClick={() => applyPatches(pending.patches)}>应用</button>
                          <button type="button" className="px-2 py-0.5 rounded border border-neutral-600" onClick={() => setPending(null)}>忽略</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {panel !== "none" && (
              <div className="absolute inset-0 bg-[#121214] flex flex-col">
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center">
                  <div className="text-sm text-white flex-1">{panel === "history" ? "历史" : "设置"} <span className="text-neutral-500 text-[11px]">自动保存</span></div>
                  <button type="button" className="text-neutral-400" onClick={() => setPanel("none")}>✕</button>
                </div>
                {panel === "history" && (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {threads.map((t) => (
                      <button key={t.id} type="button" className={`w-full text-left text-xs px-2 py-2 rounded-xl ${t.id === thread.id ? "bg-fuchsia-950/50" : "hover:bg-white/5"}`} onClick={() => { setThread(t); setPanel("none"); }}>
                        <div className="text-neutral-200 truncate">{t.title}</div>
                      </button>
                    ))}
                  </div>
                )}
                {panel === "settings" && (
                  <>
                    <div className="flex border-b border-neutral-800 text-[11px] overflow-x-auto">
                      {([
                        ["api", "API"],
                        ["params", "参数"],
                        ["persona", "人设"],
                        ["preset", "预设"],
                        ["features", "功能"],
                      ] as [Tab, string][]).map(([k, lab]) => (
                        <button key={k} type="button" className={`px-3 py-2 shrink-0 ${tab === k ? "text-fuchsia-300 border-b-2 border-fuchsia-500" : "text-neutral-500"}`} onClick={() => setTab(k)}>{lab}</button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                      {tab === "api" && (
                        <>
                          <p className="text-neutral-500">与角色对话共用这套 API。</p>
                          <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono" placeholder="API 地址" value={cfg.baseUrl} onChange={(e) => persistCfg({ ...cfg, baseUrl: e.target.value })} />
                          <div className="flex gap-1">
                            <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono" type={showKey ? "text" : "password"} placeholder="API Key" value={cfg.apiKey} onChange={(e) => persistCfg({ ...cfg, apiKey: e.target.value })} />
                            <button type="button" onClick={() => setShowKey((v) => !v)}>{showKey ? "隐" : "显"}</button>
                          </div>
                          <div className="flex gap-1">
                            <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono" value={cfg.model} onChange={(e) => persistCfg({ ...cfg, model: e.target.value })} />
                            <button type="button" className="px-2 border border-neutral-700 rounded-lg" onClick={async () => {
                              try {
                                persistCfg({ ...cfg, models: await fetchModels(cfg.baseUrl, cfg.apiKey) });
                                ping("已拉模型");
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "失败");
                              }
                            }}>获取</button>
                          </div>
                          {!!cfg.models?.length && (
                            <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5" value={cfg.model} onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}>
                              {cfg.models.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                          <label className="flex gap-2"><input type="checkbox" checked={cfg.stream} onChange={(e) => persistCfg({ ...cfg, stream: e.target.checked })} />流式</label>
                          <label className="flex gap-2"><input type="checkbox" checked={cfg.sendImages} onChange={(e) => persistCfg({ ...cfg, sendImages: e.target.checked })} />发送图片</label>
                        </>
                      )}
                      {tab === "params" && (
                        <>
                          {([
                            ["temperature", "Temperature", 0, 2, 0.05, params.temperature],
                            ["topP", "Top P", 0, 1, 0.05, params.topP],
                            ["maxTokens", "Max Tokens", 256, 16000, 256, params.maxTokens],
                          ] as const).map(([key, lab, min, max, step, val]) => (
                            <label key={key} className="block text-neutral-400">
                              <div className="flex justify-between"><span>{lab}</span><span>{val}</span></div>
                              <input type="range" min={min} max={max} step={step} value={val} className="w-full" onChange={(e) => persistParams({ ...params, [key]: Number(e.target.value) })} />
                            </label>
                          ))}
                        </>
                      )}
                      {tab === "persona" && (
                        <>
                          <p className="text-neutral-500">陪玩姬自己的人设（和角色对话预设分开）。</p>
                          <input className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5" value={persona.name} onChange={(e) => {
                            const n = { ...persona, name: e.target.value };
                            setPersona(n);
                            saveZhiPersona(n);
                          }} />
                          <textarea className="w-full min-h-[180px] bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5" value={persona.body} onChange={(e) => {
                            const n = { ...persona, body: e.target.value };
                            setPersona(n);
                            saveZhiPersona(n);
                          }} />
                          <button type="button" className="text-neutral-400" onClick={() => { const n = defaultZhiPersona(); setPersona(n); saveZhiPersona(n); }}>恢复默认稿</button>
                        </>
                      )}
                      {tab === "preset" && (
                        <PresetEditor
                          preset={preset}
                          onChange={(p) => { setPreset(p); saveChatPreset(p); }}
                          onImported={(p) => ping(`已导入 ${p.entries.length} 条 / ${(p.regexes || []).length} 正则`)}
                        />
                      )}
                      {tab === "features" && (
                        <p className="text-neutral-500">角色扮演用「角色对话」。陪玩姬可以查角色卡、按提示词库调用抽卡姬生图（需先在抽卡姬页配好工作流）、建议改卡。工具协议和原版智绘姬一样用 SystemQuery。</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {error && panel === "none" && <div className="px-3 text-[11px] text-rose-400">{error}</div>}
          {status && panel === "none" && <div className="px-3 text-[11px] text-fuchsia-300">{status}</div>}
          <div className="p-2 border-t border-neutral-800 flex items-end gap-1">
            <textarea
              rows={1}
              className="flex-1 bg-[#1c1c20] border border-neutral-700 rounded-2xl px-3 py-2 text-sm resize-none"
              placeholder="问陪玩姬… (Enter 发送)"
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {busy ? (
              <button type="button" className="w-9 h-9 rounded-full bg-neutral-700" onClick={() => abortRef.current?.abort()}>停</button>
            ) : (
              <button type="button" disabled={!draft.trim()} className="w-9 h-9 rounded-full bg-fuchsia-600 text-white disabled:opacity-40" onClick={() => void send()}>➤</button>
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
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-white text-black text-sm">{toast}</div>}
    </>
  );
}