"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
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
import { useCharacters } from "@/hooks/useCharacters";
import ChatHtml from "@/components/ChatHtml";
import PresetEditor from "@/components/PresetEditor";
import type { Character, StoredPrompt } from "@/lib/types";

type Panel = "none" | "settings" | "history";
type Tab = "api" | "params" | "persona" | "preset" | "features";

export default function ZhiHuiJiDock() {
  const pathname = usePathname() || "/";
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
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

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
      pageHint(pathname),
      pageChar ? `当前角色卡摘要：\n${pageChar.name} / ${pageChar.identity} / ${pageChar.story.slice(0, 500)}` : "",
      onShare ? "分享页：不要假设能写入对方卡，除非用户有编辑权并点了应用。" : "",
      pageChar && !onShare ? APPLY_INSTRUCTION : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const raw = await completeChat({
        config: cfg,
        params,
        signal: ac.signal,
        messages: [
          { role: "system", content: sys },
          ...hist.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        onDelta: (full) => {
          setThread((t) => ({
            ...t,
            messages: t.messages.map((m) => (m.id === asstId ? { ...m, content: full } : m)),
          }));
        },
      });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === asstId ? { ...m, content: raw } : m)),
      }));
      const patches = extractApplyPatches(raw);
      if (patches.length) setPending({ msgId: asstId, patches });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
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
          label: p.addPrompt.label || "智绘姬",
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

  return (
    <>
      <button
        type="button"
        title="智绘姬"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[70] w-14 h-14 rounded-full bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40 hover:bg-fuchsia-500 text-lg"
      >
        姬
      </button>
      {open && (
        <div className="fixed z-[76] bottom-20 right-4 w-[min(380px,calc(100vw-1.5rem))] h-[min(560px,calc(100vh-7rem))] rounded-2xl border border-neutral-700 bg-[#121214]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-fuchsia-800 text-white text-xs flex items-center justify-center">姬</div>
            <div className="flex-1 min-w-0 ml-1">
              <div className="text-sm text-white truncate">{persona.name}</div>
              <div className="text-[10px] text-neutral-500 truncate">{thread.title}</div>
            </div>
            <button type="button" className="text-neutral-400 w-7 h-7" title="历史" onClick={() => setPanel(panel === "history" ? "none" : "history")}>🕒</button>
            <button type="button" className="text-neutral-400 w-7 h-7" title="新建" onClick={() => { setThread(emptyZhiThread()); setPanel("none"); }}>🧹</button>
            <button type="button" className="text-neutral-400 w-7 h-7" title="设置" onClick={() => setPanel(panel === "settings" ? "none" : "settings")}>⚙</button>
            <button type="button" className="text-neutral-400 w-7 h-7" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="relative flex-1 min-h-0">
            <div ref={logRef} className="absolute inset-0 overflow-y-auto p-3 space-y-3 flex flex-col">
              {thread.messages.length === 0 && (
                <div className="text-sm text-neutral-400 bg-[#1c1c20] border border-neutral-800 rounded-2xl px-3 py-2 max-w-[90%]">
                  你好，我是{persona.name}。问用法、改设定建议都可以。和角色演戏请用「角色对话」。
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
                      {mine ? m.content : <ChatHtml raw={m.content || (busy ? "…" : "")} regexes={preset?.regexes} />}
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
                          <p className="text-neutral-500">智绘姬自己的人设（和角色对话预设分开）。</p>
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
                        <p className="text-neutral-500">角色扮演用右下角旁边的「角色对话」。这里负责改设定、答疑。对话预设和正则在「预设」里改，和原版智绘姬一样从浮窗进。</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {error && panel === "none" && <div className="px-3 text-[11px] text-rose-400">{error}</div>}
          <div className="p-2 border-t border-neutral-800 flex items-end gap-1">
            <textarea
              rows={1}
              className="flex-1 bg-[#1c1c20] border border-neutral-700 rounded-2xl px-3 py-2 text-sm resize-none"
              placeholder="问智绘姬… (Enter 发送)"
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
        </div>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-white text-black text-sm">{toast}</div>}
    </>
  );
}