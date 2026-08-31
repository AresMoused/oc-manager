"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AiApiConfig, AiModelParams, ChatMessage } from "@/lib/aiConfig";
import { completeChat, fetchModels } from "@/lib/aiConfig";
import {
  type ChatPresetFile,
  type ChatTurn,
  APPLY_INSTRUCTION,
  extractApplyPatches,
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
import { useWorlds } from "@/hooks/useWorlds";
import { useAppData } from "@/context/AppDataContext";
import { getLore } from "@/lib/worldLore";
import { pendingFromApply, type ZhiPendingChange } from "@/lib/zhiSkills";
import ChatHtml from "@/components/ChatHtml";
import ChatImage, { ImagePreview } from "@/components/ChatImage";
import PresetEditor from "@/components/PresetEditor";
import RequestTypesPanel from "@/components/RequestTypesPanel";
import { generateCharacterStill } from "@/lib/chatImage";
import type { Character, GalleryImage } from "@/lib/types";
import ChatMsgBar from "@/components/ChatMsgBar";
import { useDockGeo } from "@/hooks/useDockGeo";

type Panel = "none" | "settings" | "history";
type Tab = "api" | "params" | "persona" | "preset" | "types" | "features";

export default function ZhiHuiJiDock() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { characters, updateCharacter, addCharacter, deleteCharacter, addTimelineEvent } = useCharacters();
  const { worlds, updateWorld } = useWorlds();
  const { lore, setLore } = useAppData();
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
  const [pending, setPending] = useState<ZhiPendingChange[]>([]);
  const [task, setTask] = useState<ZhiTask | null>(null);
  const [status, setStatus] = useState("");
  const [autoImage, setAutoImage] = useState(false);
  const [preview, setPreview] = useState<{ url: string; charId?: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
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
    setAutoImage(localStorage.getItem("oc-zhi-auto-image") === "1");
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

  const send = async (presetText?: string, historyOverride?: ChatTurn[]) => {
    const text = (presetText ?? draft).trim();
    if (!text || busy) return;
    if (!cfg.apiKey.trim()) {
      setError("请先填 API");
      setPanel("settings");
      setTab("api");
      return;
    }
    setError("");
    const base = historyOverride ?? thread.messages;
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
      title: base.length ? t.title : text.slice(0, 18),
      messages: [
        ...base,
        userTurn,
        { id: asstId, role: "assistant", speakerName: persona.name, content: "", at: new Date().toISOString() },
      ],
    }));
    if (presetText == null) setDraft("");
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const hist = [...base, userTurn].slice(-12);
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
      const allPending: ZhiPendingChange[] = [];
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
        const runQ = autoImage
          ? queries.filter((q) => String(q.skill || q.type) !== "generate_image")
          : queries;
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === asstId ? { ...m, content: stripSystemQueries(raw) || raw } : m
          ),
        }));
        if (!runQ.length) {
          const stall = /稍等|等一下|先调取|马上帮|我来整理|让我先|先看一下/.test(raw);
          if (stall && round < 3) {
            messages.push({ role: "assistant", content: raw });
            messages.push({
              role: "user",
              content:
                "【系统】不要只说稍等。立刻输出 SystemQuery，skill 从技能列表里选。填外观用 fill_appearance，查卡用 read_character。",
            });
            continue;
          }
          break;
        }
        const result = await runQueries(runQ, {
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
          logSource: "陪玩姬",
          lastUserLine: text,
          preferCharacter: pageChar,
          worlds,
          lore,
          canWrite: !onShare,
          ai: { config: cfg, params },
          historyText: hist.map((m) => `${m.role}: ${m.content}`).join("\n").slice(-4000),
        });
        lastCharId = result.characterId || lastCharId;
        allPending.push(...result.pending);
        for (const url of result.images) allImages.push({ url, characterId: result.characterId || lastCharId });
        messages.push({ role: "assistant", content: raw });
        messages.push({ role: "user", content: `【系统自动回复】\n${result.text}` });
      }
      if (autoImage && !allImages.length) {
        const subject = pageChar || characters[0];
        if (subject) {
          setStatus(`出图中 · ${subject.name}`);
          try {
            const job = await generateCharacterStill(subject, "", ac.signal, "陪玩姬", {
              config: cfg,
              params,
              history: thread.messages.map((m) => `${m.role}: ${m.content}`).join("\n").slice(-4000),
              userLine: text,
              characters,
            });
            lastCharId = subject.id;
            for (const url of job.urls) allImages.push({ url, characterId: subject.id });
          } catch (e) {
            ping(e instanceof Error ? e.message : "出图失败");
          }
        } else {
          ping("自动出图需要角色页或至少一张卡");
        }
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
      const fromApply = patches
        .map((p) => pendingFromApply(p, resolveApplyTarget(p, characters, pageChar || characters[0]!)))
        .filter((c) => c.characterId);
      const nextPending = [...allPending, ...fromApply];
      if (nextPending.length) setPending(nextPending);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const lastAsstId = [...thread.messages]
    .reverse()
    .find((m) => m.role === "assistant" && !(m.imageUrl && m.content === "图"))?.id;

  const regenLast = () => {
    const msgs = thread.messages;
    let userIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]!.role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) return;
    void send(msgs[userIdx]!.content, msgs.slice(0, userIdx));
  };

  const deleteMsg = (id: string) => {
    setThread((t) => ({ ...t, messages: t.messages.filter((m) => m.id !== id) }));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (m: ChatTurn) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const saveEdit = (id: string) => {
    const idx = thread.messages.findIndex((m) => m.id === id);
    const msg = thread.messages[idx];
    if (!msg) return;
    const text = editDraft.trim();
    setEditingId(null);
    if (!text) {
      deleteMsg(id);
      return;
    }
    if (msg.role === "user") {
      const laterUser = thread.messages.slice(idx + 1).some((m) => m.role === "user");
      if (!laterUser) {
        void send(text, thread.messages.slice(0, idx));
        return;
      }
    }
    setThread((t) => ({
      ...t,
      messages: t.messages.map((m) => (m.id === id ? { ...m, content: text } : m)),
    }));
  };

  const removeThread = (id: string) => {
    const rest = threads.filter((t) => t.id !== id);
    const next = thread.id === id ? rest[0] || emptyZhiThread() : thread;
    const store = {
      currentId: next.id,
      threads: rest.some((t) => t.id === next.id)
        ? rest.map((t) => (t.id === next.id ? next : t))
        : [next, ...rest],
    };
    saveZhiThreads(store);
    setThreads(store.threads);
    setThread(next);
  };

  const applyPending = async (items: ZhiPendingChange[]) => {
    if (onShare) {
      ping("分享页请用角色对话窗，且需有编辑权");
      setPending([]);
      return;
    }
    for (const ch of items) {
      if (ch.kind === "character" && ch.characterId) {
        if (ch.characterPatch) updateCharacter(ch.characterId, ch.characterPatch);
        if (ch.timelineEvent) addTimelineEvent(ch.characterId, ch.timelineEvent);
      } else if (ch.kind === "create_character" && ch.createDraft) {
        await addCharacter(ch.createDraft);
      } else if (ch.kind === "delete_character" && ch.characterId) {
        await deleteCharacter(ch.characterId);
      } else if (ch.kind === "world" && ch.worldId && ch.worldPatch) {
        updateWorld(ch.worldId, ch.worldPatch);
      } else if (ch.kind === "lore" && ch.loreWorld && ch.loreSection && ch.loreEntry) {
        setLore((prev) => {
          const cur = getLore(prev, ch.loreWorld!);
          const section = ch.loreSection!;
          const arr = [...((cur[section] as { id?: string; name?: string }[]) || [])];
          const entry = { id: String(ch.loreEntry!.id || crypto.randomUUID()), ...ch.loreEntry } as { id: string; name?: string };
          const i = arr.findIndex((x) => x.id === entry.id || (entry.name && x.name === entry.name));
          if (i >= 0) arr[i] = { ...arr[i], ...entry };
          else arr.push(entry);
          return { ...prev, [ch.loreWorld!]: { ...cur, [section]: arr } };
        });
      }
    }
    setPending([]);
    ping("已应用修改");
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
                const editing = editingId === m.id;
                return (
                  <div key={m.id} className={`flex gap-2 max-w-[90%] ${mine ? "self-end flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs ${mine ? "bg-purple-800" : "bg-fuchsia-800"}`}>
                      {mine ? "你" : "姬"}
                    </div>
                    <div className="min-w-0">
                      <div className={`rounded-2xl px-3 py-2 text-sm border ${mine ? "bg-purple-600/20 border-purple-800/50 whitespace-pre-wrap" : "bg-[#1c1c20] border-neutral-800"}`}>
                        {m.imageUrl && (
                          <ChatImage
                            url={m.imageUrl}
                            canSave={!onShare}
                            onPreview={() => setPreview({ url: m.imageUrl!, charId: m.speakerId })}
                            onSave={() => void saveToGallery(m.imageUrl!, m.speakerId)}
                          />
                        )}
                        {editing ? (
                          <textarea
                            className="w-full min-h-[72px] bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-sm"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                          />
                        ) : mine ? (
                          m.content
                        ) : m.content === "图" && m.imageUrl ? null : (
                          <ChatHtml raw={m.content || (busy ? "…" : "")} regexes={preset?.regexes} />
                        )}
                      </div>
                      {editing ? (
                        <div className="flex gap-1.5 mt-1 text-[10px]">
                          <button type="button" className="text-fuchsia-300" onClick={() => saveEdit(m.id)}>保存{mine ? "并重发" : ""}</button>
                          <button type="button" className="text-neutral-500" onClick={() => setEditingId(null)}>取消</button>
                        </div>
                      ) : (
                        <ChatMsgBar
                          disabled={busy}
                          onEdit={m.content === "图" ? undefined : () => startEdit(m)}
                          onDelete={() => deleteMsg(m.id)}
                          onRegen={!mine && m.id === lastAsstId ? regenLast : undefined}
                        />
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
                      <div key={t.id} className={`flex items-center gap-1 rounded-xl ${t.id === thread.id ? "bg-fuchsia-950/50" : "hover:bg-white/5"}`}>
                        <button type="button" className="flex-1 min-w-0 text-left text-xs px-2 py-2" onClick={() => { setThread(t); setPanel("none"); }}>
                          <div className="text-neutral-200 truncate">{t.title}</div>
                        </button>
                        <button type="button" className="text-neutral-500 hover:text-rose-300 px-2 text-[11px]" onClick={() => removeThread(t.id)}>删</button>
                      </div>
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
                        ["types", "请求类型"],
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
                      {tab === "types" && <RequestTypesPanel onPing={ping} />}
                      {tab === "features" && (
                        <>
                          <label className="flex items-center gap-2 text-neutral-300">
                            <input
                              type="checkbox"
                              checked={autoImage}
                              onChange={(e) => {
                                setAutoImage(e.target.checked);
                                localStorage.setItem("oc-zhi-auto-image", e.target.checked ? "1" : "0");
                              }}
                            />
                            每轮对话自动出一张图（当前角色卡提示词）
                          </label>
                          <p className="text-neutral-500">先看技能列表再决定调哪一个。读立刻执行；写只出待确认草稿，你点应用才入库。</p>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {pending.length > 0 && panel === "none" && (
            <div className="px-3 py-2 border-t border-amber-900/50 bg-amber-950/40 text-[11px] max-h-44 overflow-y-auto space-y-1">
              <div className="text-amber-200">待确认的修改（不会自动写入）</div>
              {pending.map((ch) => (
                <div key={ch.id} className="text-amber-50">
                  <span className="text-amber-300">{ch.title}</span>
                  <div className="text-neutral-400 whitespace-pre-wrap">{ch.summary.slice(0, 360)}</div>
                </div>
              ))}
              <div className="flex gap-1 pt-1">
                <button type="button" className="px-2 py-0.5 rounded bg-purple-600 text-white" onClick={() => void applyPending(pending)}>应用全部</button>
                <button type="button" className="px-2 py-0.5 rounded border border-neutral-600 text-neutral-300" onClick={() => setPending([])}>忽略</button>
              </div>
            </div>
          )}
          {error && panel === "none" && <div className="px-3 text-[11px] text-rose-400">{error}</div>}
          {status && panel === "none" && <div className="px-3 text-[11px] text-fuchsia-300">{status}</div>}
          <div className="p-2 border-t border-neutral-800 flex items-end gap-1">
            <button
              type="button"
              title={autoImage ? "自动出图开" : "自动出图关"}
              className={`w-9 h-9 rounded-full text-sm shrink-0 ${autoImage ? "bg-fuchsia-600 text-white" : "text-neutral-400 hover:bg-white/10"}`}
              onClick={() => {
                const next = !autoImage;
                setAutoImage(next);
                localStorage.setItem("oc-zhi-auto-image", next ? "1" : "0");
              }}
            >
              图
            </button>
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
              <>
                {lastAsstId && (
                  <button type="button" className="w-9 h-9 rounded-full border border-neutral-700 text-neutral-300 text-[11px]" title="重新生成" onClick={regenLast}>↻</button>
                )}
                <button type="button" disabled={!draft.trim()} className="w-9 h-9 rounded-full bg-fuchsia-600 text-white disabled:opacity-40" onClick={() => void send()}>➤</button>
              </>
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
      {preview && (
        <ImagePreview
          url={preview.url}
          canSave={!onShare}
          onSave={() => void saveToGallery(preview.url, preview.charId)}
          onClose={() => setPreview(null)}
        />
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-white text-black text-sm">{toast}</div>}
    </>
  );
}