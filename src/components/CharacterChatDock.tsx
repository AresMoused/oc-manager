"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, GalleryImage, StoredPrompt, TimelineEvent } from "@/lib/types";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
import { completeChat, fetchModels } from "@/lib/aiConfig";
import {
  type ApplyPatch,
  type ChatPresetFile,
  type ChatSession,
  type ChatTurn,
  type SoloMode,
  buildChatMessages,
  buildSummaryMessages,
  deleteChatThread,
  displayReply,
  emptySession,
  extractApplyPatches,
  fieldsFromPatch,
  listChatThreads,
  loadChatApiConfig,
  loadChatParams,
  loadChatPreset,
  loadChatSession,
  loadTestPersona,
  parseSummaryJson,
  recentUnsummarized,
  resolveApplyTarget,
  saveChatApiConfig,
  saveChatParams,
  saveChatPreset,
  saveChatSession,
  saveTestPersona,
  toTimelineEvent,
  unsummarizedUserCount,
  type TestPersona,
} from "@/lib/characterChat";
import { extractSystemQueries, runQueries, stripSystemQueries } from "@/lib/zhiTools";
import { illustrateReply } from "@/lib/chatImage";
import { type ZhiPendingChange } from "@/lib/zhiSkills";
import ChatHtml from "@/components/ChatHtml";
import ChatImage, { ImagePreview } from "@/components/ChatImage";
import PresetEditor from "@/components/PresetEditor";
import RequestTypesPanel from "@/components/RequestTypesPanel";
import ChatMsgBar from "@/components/ChatMsgBar";
import { useDockGeo } from "@/hooks/useDockGeo";

type Panel = "none" | "settings" | "history" | "summary";
type SettingsTab = "api" | "params" | "preset" | "persona" | "types" | "features";

function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const letter = (name || "?").slice(0, 1);
  return src ? (
    <img
      src={src}
      alt=""
      className="rounded-full object-cover shrink-0 bg-neutral-800"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full shrink-0 bg-purple-900/80 text-purple-100 flex items-center justify-center text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {letter}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 text-sm leading-none"
    >
      {children}
    </button>
  );
}

export default function CharacterChatDock({
  host,
  characters,
  onWriteTimeline,
  onPatchCharacter,
  localOnly = false,
  canEditCard = true,
  sessionKey,
}: {
  host: Character;
  characters: Character[];
  onWriteTimeline: (charIds: string[], event: Omit<TimelineEvent, "id">) => void;
  onPatchCharacter: (id: string, patch: Partial<Character>) => void;
  localOnly?: boolean;
  canEditCard?: boolean;
  sessionKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const { panelRef, panelStyle, fabStyle, headerDrag, resizeHandle, fabDrag } = useDockGeo("oc-character-chat-geo-v1");
  const [panel, setPanel] = useState<Panel>("none");
  const [setTab, setSetTab] = useState<SettingsTab>("api");
  const [cfg, setCfg] = useState<AiApiConfig>(() => loadChatApiConfig());
  const [params, setParams] = useState<AiModelParams>(() => loadChatParams());
  const [preset, setPreset] = useState<ChatPresetFile | null>(null);
  const [session, setSession] = useState<ChatSession>(() => emptySession(host.id));
  const [threads, setThreads] = useState<ChatSession[]>([]);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState<{ msgId: string; patches: ApplyPatch[] } | null>(null);
  const [skillPending, setSkillPending] = useState<ZhiPendingChange[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [testPersona, setTestPersona] = useState<TestPersona>({ name: "玩家", body: "" });
  const [preview, setPreview] = useState<{ url: string; charId?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const storeId = sessionKey || host.id;

  const worldMates = useMemo(() => {
    const same = characters.filter((c) => c.world && c.world === host.world);
    return same.length ? same : characters;
  }, [characters, host.world]);

  const refreshThreads = (hostId: string) => setThreads(listChatThreads(hostId));

  useEffect(() => {
    setPreset(loadChatPreset());
    setTestPersona(loadTestPersona());
    const saved = loadChatSession(storeId);
    const s = saved || emptySession(storeId);
    if (localOnly) s.autoSummary = saved?.autoSummary ?? false;
    if (!canEditCard) s.allowCardEdit = false;
    setSession(s);
    refreshThreads(storeId);
    setPanel("none");
  }, [storeId, localOnly, canEditCard]);

  useEffect(() => {
    saveChatSession(session);
    refreshThreads(session.hostId);
  }, [session]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session.messages, busy]);

  const present = worldMates.filter((c) => session.participantIds.includes(c.id));
  const pov = present.find((c) => c.id === session.povId) || present[0] || host;
  const solo = present.length <= 1;
  const others = present.filter((c) => c.id !== pov.id);
  const star = present[0] || host;
  const voiceName = session.soloMode === "monologue" ? "脑内的声音" : "神秘声音";
  const playerName = session.useTestPersona && testPersona.name.trim()
    ? testPersona.name
    : solo
      ? voiceName
      : pov.name;
  const ping = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };
  const saveToGallery = async (url: string, characterId?: string) => {
    if (!canEditCard || localOnly) {
      ping(localOnly ? "分享页对话不能写入画廊" : "没有编辑权");
      return;
    }
    const id = characterId || host.id;
    const target = characters.find((c) => c.id === id) || host;
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const file = new File([blob], "chat.png", { type: blob.type || "image/png" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      const item: GalleryImage = { id: crypto.randomUUID(), url: data.url, caption: "对话生成" };
      onPatchCharacter(target.id, { gallery: [...(target.gallery || []), item] });
      ping(`已加入 ${target.name} 画廊`);
    } catch (e) {
      ping(e instanceof Error ? e.message : "保存失败");
    }
  };
  const persistCfg = (next: AiApiConfig) => {
    setCfg(next);
    saveChatApiConfig(next);
  };
  const persistParams = (next: AiModelParams) => {
    setParams(next);
    saveChatParams(next);
  };

  const asstName = solo
    ? star.name
    : others.map((c) => c.name).join("、") || "对方";
  const asstAvatar = solo ? star.avatar : others[0]?.avatar;

  const runSummary = useCallback(
    async (all: ChatTurn[]) => {
      const pending = recentUnsummarized(all, 5);
      if (!pending.length) return;
      const names = present.map((c) => c.name);
      if (solo) names.push(session.soloMode === "mystery" ? "神秘声音" : pov.name);
      const raw = await completeChat({
        config: { ...cfg, stream: false },
        params: { ...params, maxTokens: Math.min(params.maxTokens, 800) },
        messages: buildSummaryMessages(pending, names),
        logSource: "角色对话",
        logTitle: "总结",
      });
      const parsed = parseSummaryJson(raw);
      if (!parsed) throw new Error("总结解析失败");
      const ev = toTimelineEvent(parsed, names);
      if (!localOnly) onWriteTimeline(present.map((c) => c.id), ev);
      setSession((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          pending.some((p) => p.id === m.id) ? { ...m, summarized: true } : m
        ),
        summaries: [
          ...(s.summaries || []),
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            title: ev.title,
            description: ev.description,
            names,
          },
        ],
      }));
      ping(localOnly ? "已记入本机总结（不写时间线）" : "已写入在场角色时间线");
    },
    [cfg, params, present, solo, session.soloMode, pov.name, onWriteTimeline, localOnly]
  );

  const send = async (presetText?: string, historyOverride?: ChatTurn[]) => {
    const text = (presetText ?? draft).trim();
    const regen = historyOverride != null;
    if ((!text && !image) || busy) return;
    if (!cfg.apiKey.trim() || !cfg.baseUrl.trim()) {
      setError("请先在设置里填写对话 API");
      setPanel("settings");
      setSetTab("api");
      return;
    }
    if (!preset) {
      setError("请先导入对话预设文件");
      setPanel("settings");
      setSetTab("preset");
      return;
    }
    setError("");
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      speakerId: pov.id,
      speakerName: playerName,
      content: text || "（附图）",
      imageUrl: regen ? undefined : image || undefined,
      at: new Date().toISOString(),
    };
    const base = historyOverride ?? session.messages;
    const nextMsgs = [...base, userTurn];
    const asstId = crypto.randomUUID();
    const title =
      base.length === 0 && text
        ? text.slice(0, 18)
        : session.title;
    setSession((s) => ({
      ...s,
      title,
      messages: [
        ...nextMsgs,
        {
          id: asstId,
          role: "assistant",
          speakerName: asstName,
          content: "",
          at: new Date().toISOString(),
        },
      ],
    }));
    setDraft("");
    const img = regen ? null : image;
    setImage(null);
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const messages = buildChatMessages({
        preset,
        present: present.length ? present : [host],
        pov,
        soloMode: session.soloMode,
        scene: session.scene,
        history: nextMsgs,
        userLine: text || "（附图）",
        imageUrl: cfg.sendImages ? img || undefined : undefined,
        allowCardEdit: canEditCard && session.allowCardEdit !== false,
        testPersona: session.useTestPersona ? testPersona : null,
        allowImageGen: false,
      });
      const raw = await completeChat({
        config: cfg,
        params,
        messages,
        signal: ac.signal,
        logSource: "角色对话",
        logTitle: session.title || host.name,
        onDelta: (full) => {
          setSession((s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === asstId ? { ...m, content: stripSystemQueries(full) || full } : m
            ),
          }));
        },
      });
      const visible = stripSystemQueries(raw) || raw;
      let finalMsgs: ChatTurn[] = [];
      setSession((s) => {
        finalMsgs = s.messages.map((m) => (m.id === asstId ? { ...m, content: visible } : m));
        return { ...s, messages: finalMsgs };
      });
      const queries = extractSystemQueries(raw).filter((q) => String(q.skill || q.type) !== "generate_image");
      if (queries.length) {
        const result = await runQueries(queries, {
          characters,
          pageCharacter: host,
          pathname: `/character/${host.id}`,
          signal: ac.signal,
          task: null,
          onTask: () => {},
          onStatus: () => {},
          logSource: "角色对话",
          lastUserLine: text,
          lastAssistantLine: visible,
          preferCharacter: solo ? star : others[0] || host,
          selfCharacter: solo ? star : pov,
          canWrite: canEditCard && !localOnly,
          ai: { config: cfg, params },
          historyText: nextMsgs.map((m) => `${m.speakerName}: ${m.content}`).join("\n").slice(-4000),
        });
        if (result.pending.length) setSkillPending(result.pending);
        if (result.images.length) {
          setSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              ...result.images.map((url) => ({
                id: crypto.randomUUID(),
                role: "assistant" as const,
                speakerName: asstName,
                speakerId: result.characterId,
                content: "图",
                imageUrl: url,
                at: new Date().toISOString(),
              })),
            ],
          }));
        }
      }
      if (session.autoImage && visible.trim() && cfg.apiKey) {
        const subject = solo ? star : others[0] || host;
        ping(`出图中 · ${subject.name}`);
        try {
          const illus = await illustrateReply({
            character: subject,
            characters,
            body: displayReply(visible),
            history: [...nextMsgs, { speakerName: asstName, content: visible }]
              .map((m) => `${m.speakerName}: ${m.content}`)
              .join("\n")
              .slice(-4000),
            config: cfg,
            params,
            signal: ac.signal,
            source: "角色对话",
          });
          if (illus.urls.length) {
            setSession((s) => ({
              ...s,
              messages: [
                ...s.messages,
                ...illus.urls.map((url) => ({
                  id: crypto.randomUUID(),
                  role: "assistant" as const,
                  speakerName: subject.name,
                  speakerId: subject.id,
                  content: "图",
                  imageUrl: url,
                  at: new Date().toISOString(),
                })),
              ],
            }));
          }
        } catch (e) {
          ping(e instanceof Error ? e.message : "出图失败");
        }
      }
      const patches = canEditCard && session.allowCardEdit !== false ? extractApplyPatches(raw) : [];
      if (patches.length) setPending({ msgId: asstId, patches });
      if (session.autoSummary && unsummarizedUserCount(finalMsgs) >= 5) {
        try {
          await runSummary(finalMsgs);
        } catch (e) {
          setError(e instanceof Error ? e.message : "自动总结失败");
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const lastAsstId = [...session.messages]
    .reverse()
    .find((m) => m.role === "assistant" && !(m.imageUrl && m.content === "图"))?.id;

  const regenLast = () => {
    const msgs = session.messages;
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
    setSession((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) }));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (m: ChatTurn) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const saveEdit = (id: string) => {
    const idx = session.messages.findIndex((m) => m.id === id);
    const msg = session.messages[idx];
    if (!msg) return;
    const text = editDraft.trim();
    setEditingId(null);
    if (!text) {
      deleteMsg(id);
      return;
    }
    if (msg.role === "user") {
      const laterUser = session.messages.slice(idx + 1).some((m) => m.role === "user");
      if (!laterUser) {
        void send(text, session.messages.slice(0, idx));
        return;
      }
    }
    setSession((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: text } : m)),
    }));
  };

  const newChat = () => {
    const s = emptySession(storeId);
    s.participantIds = session.participantIds;
    s.povId = session.povId;
    s.soloMode = session.soloMode;
    s.scene = session.scene;
    s.autoSummary = session.autoSummary;
    s.autoImage = session.autoImage;
    s.allowCardEdit = session.allowCardEdit;
    s.useTestPersona = session.useTestPersona;
    setSession(s);
    setPanel("none");
    ping("已新建聊天");
  };

  const applyPatches = (patches: ApplyPatch[]) => {
    if (!canEditCard) {
      ping("此分享页没有编辑权");
      setPending(null);
      return;
    }
    for (const p of patches) {
      const target = resolveApplyTarget(p, present.length ? present : [host], host);
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
          label: p.addPrompt.label || "对话生成",
          createdAt: new Date().toISOString(),
        };
        patch.prompts = [...(target.prompts || []), item];
      }
      if (Object.keys(patch).length) onPatchCharacter(target.id, patch);
      if (p.addTimeline?.title && !localOnly) {
        onWriteTimeline([target.id], {
          date: new Date().toISOString().slice(0, 10),
          title: p.addTimeline.title,
          description: p.addTimeline.description || "",
          importance: "normal",
        });
      }
    }
    setPending(null);
    ping("已应用到角色卡");
  };

  const applySkillPending = (items: ZhiPendingChange[]) => {
    if (!canEditCard || localOnly) {
      ping(localOnly ? "分享页对话不能写入卡" : "没有编辑权");
      return;
    }
    for (const ch of items) {
      if (ch.kind === "character" && ch.characterId && ch.characterPatch) {
        onPatchCharacter(ch.characterId, ch.characterPatch);
      }
      if (ch.timelineEvent && ch.characterId) {
        onWriteTimeline([ch.characterId], ch.timelineEvent);
      }
      if (ch.kind !== "character" && ch.kind !== "create_character") {
        ping(`${ch.title} 请用陪玩姬确认（世界/设定类）`);
      }
    }
    setSkillPending([]);
    ping("已应用修改");
  };

  const shortcuts: { label: string; prompt: string }[] = [
    { label: "补全人设", prompt: "请根据当前角色卡空缺，补全人设（经历、身份、现住、派系等），用 <apply> 提交建议。这次不要展开角色扮演。" },
    { label: "根据对话更新", prompt: "根据刚才的对话，把新的经历或关系写进设定，用 <apply> 提交。不要重复已有内容。" },
    { label: "生成外观词", prompt: "根据角色卡生成一组 Danbooru 外观提示词，用 addPrompt 经 <apply> 提交。不要展开角色扮演。" },
  ];

  return (
    <>
      <button
        type="button"
        title="角色对话"
        className="fixed z-[70] w-12 h-12 rounded-full bg-violet-700 text-white shadow-lg hover:bg-violet-600 text-base"
        style={fabStyle(48, { right: 80, bottom: 20 })}
        {...fabDrag(() => setOpen((v) => !v), 48)}
      >
        💬
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[75] rounded-2xl border border-neutral-700 bg-[#121214]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
          style={panelStyle}
        >
          <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-1 cursor-grab active:cursor-grabbing" {...headerDrag}>
            <Avatar src={host.avatar} name={host.name} size={28} />
            <div className="flex-1 min-w-0 ml-1">
              <div className="text-sm text-white truncate">{session.title || "角色对话"}</div>
              <div className="text-[10px] text-neutral-500 truncate">
                {pov.name}
                {solo ? ` · 你是${voiceName}` : ` · ${present.length} 人在场`}
              </div>
            </div>
            <IconBtn title="聊天历史" onClick={() => setPanel(panel === "history" ? "none" : "history")}>🕒</IconBtn>
            <IconBtn title="新建聊天" onClick={newChat}>🧹</IconBtn>
            <IconBtn title="聊天总结" onClick={() => setPanel(panel === "summary" ? "none" : "summary")}>📚</IconBtn>
            <IconBtn title="设置" onClick={() => setPanel(panel === "settings" ? "none" : "settings")}>⚙</IconBtn>
            <IconBtn title="关闭" onClick={() => setOpen(false)}>✕</IconBtn>
          </div>

          <div className="relative flex-1 min-h-0">
            <div ref={logRef} className="absolute inset-0 overflow-y-auto p-3 space-y-3 flex flex-col">
              {session.messages.length === 0 && (
                <div className="flex gap-2 max-w-[90%]">
                  <Avatar src={asstAvatar} name={asstName} />
                  <div className="bg-[#1c1c20] border border-neutral-800 rounded-2xl px-3 py-2 text-sm text-neutral-300">
                    你好，我在听。用{solo ? voiceName : ` ${pov.name} 的视角`}说第一句话吧。
                  </div>
                </div>
              )}
              {session.messages.map((m) => {
                const mine = m.role === "user";
                const editing = editingId === m.id;
                return (
                  <div key={m.id} className={`flex gap-2 max-w-[90%] ${mine ? "self-end flex-row-reverse" : ""}`}>
                    <Avatar
                      src={mine ? pov.avatar : asstAvatar}
                      name={mine ? m.speakerName : m.speakerName}
                    />
                    <div>
                      <div className={`text-[10px] text-neutral-500 mb-0.5 ${mine ? "text-right" : ""}`}>
                        {m.speakerName}
                        {m.summarized ? " · 已总结" : ""}
                      </div>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm border ${
                          mine
                            ? "bg-purple-600/20 border-purple-800/50 text-purple-50 whitespace-pre-wrap"
                            : "bg-[#1c1c20] border-neutral-800 text-neutral-200"
                        }`}
                      >
                        {m.imageUrl && (
                          <ChatImage
                            url={m.imageUrl}
                            canSave={canEditCard && !localOnly}
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
                        ) : m.imageUrl && m.content === "图" ? null : !String(m.content || "").trim() ? (
                          <span className="text-neutral-500">{busy ? "…" : ""}</span>
                        ) : (
                          <ChatHtml raw={m.content} regexes={preset?.regexes} />
                        )}
                      </div>
                      {editing ? (
                        <div className="flex gap-1.5 mt-1 text-[10px]">
                          <button type="button" className="text-purple-300" onClick={() => saveEdit(m.id)}>保存{mine ? "并重发" : ""}</button>
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
                      {!mine && pending?.msgId === m.id && (
                        <div className="mt-1.5 space-y-1">
                          {pending.patches.map((p, i) => {
                            const t = resolveApplyTarget(p, present.length ? present : [host], host);
                            const keys = Object.keys(fieldsFromPatch(p));
                            return (
                              <div key={i} className="text-[11px] border border-amber-900/50 bg-amber-950/30 rounded-xl px-2 py-1.5 text-amber-100">
                                <div>建议改 {t.name}{p.note ? `：${p.note}` : ""}</div>
                                {!!keys.length && <div className="text-neutral-400">字段 {keys.join("、")}</div>}
                                {p.addPrompt && <div className="text-neutral-400">外观词 {p.addPrompt.text.slice(0, 80)}</div>}
                                {p.addTimeline && <div className="text-neutral-400">时间线 {p.addTimeline.title}</div>}
                              </div>
                            );
                          })}
                          <div className="flex gap-1">
                            <button type="button" className="px-2 py-0.5 rounded-lg bg-purple-600 text-white text-[11px]" onClick={() => applyPatches(pending.patches)}>应用</button>
                            <button type="button" className="px-2 py-0.5 rounded-lg border border-neutral-700 text-neutral-400 text-[11px]" onClick={() => setPending(null)}>忽略</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {panel !== "none" && (
              <div className="absolute inset-0 bg-[#121214] flex flex-col animate-in">
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center">
                  <div className="text-sm text-white flex-1">
                    {panel === "settings" ? "设置" : panel === "history" ? "聊天历史" : "聊天总结"}
                    {panel === "settings" && <span className="text-neutral-500 text-[11px] ml-2">自动保存</span>}
                  </div>
                  <IconBtn title="关闭" onClick={() => setPanel("none")}>✕</IconBtn>
                </div>

                {panel === "settings" && (
                  <>
                    <div className="flex border-b border-neutral-800 text-[11px]">
                      {([
                        ["api", "API"],
                        ["params", "参数"],
                        ["preset", "预设"],
                        ["persona", "人设"],
                        ["types", "类型"],
                        ["features", "功能"],
                      ] as [SettingsTab, string][]).map(([k, lab]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSetTab(k)}
                          className={`flex-1 py-2 ${setTab === k ? "text-purple-300 border-b-2 border-purple-500" : "text-neutral-500"}`}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                      {setTab === "api" && (
                        <>
                          <label className="block text-neutral-400">API 地址
                            <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono text-neutral-200" placeholder="https://api.deepseek.com" value={cfg.baseUrl} onChange={(e) => persistCfg({ ...cfg, baseUrl: e.target.value })} />
                          </label>
                          <label className="block text-neutral-400">API Key
                            <div className="flex gap-1 mt-1">
                              <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono text-neutral-200" type={showKey ? "text" : "password"} value={cfg.apiKey} onChange={(e) => persistCfg({ ...cfg, apiKey: e.target.value })} />
                              <button type="button" className="text-neutral-400 px-1" onClick={() => setShowKey((v) => !v)}>{showKey ? "隐" : "显"}</button>
                            </div>
                          </label>
                          <label className="block text-neutral-400">模型
                            <div className="flex gap-1 mt-1">
                              <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 font-mono text-neutral-200" value={cfg.model} onChange={(e) => persistCfg({ ...cfg, model: e.target.value })} />
                              <button type="button" className="px-2 border border-neutral-700 rounded-lg text-neutral-300" onClick={async () => {
                                try {
                                  const ids = await fetchModels(cfg.baseUrl, cfg.apiKey);
                                  persistCfg({ ...cfg, models: ids });
                                  ping(`拉到 ${ids.length} 个`);
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "失败");
                                }
                              }}>获取</button>
                            </div>
                          </label>
                          {!!cfg.models?.length && (
                            <select className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200" value={cfg.model} onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}>
                              {cfg.models.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                          <label className="flex items-center gap-2 text-neutral-300"><input type="checkbox" checked={cfg.stream} onChange={(e) => persistCfg({ ...cfg, stream: e.target.checked })} />流式生成</label>
                          <label className="flex items-center gap-2 text-neutral-300"><input type="checkbox" checked={cfg.mergeSystemUser} onChange={(e) => persistCfg({ ...cfg, mergeSystemUser: e.target.checked })} />合并 System 和 User</label>
                          <label className="flex items-center gap-2 text-neutral-300"><input type="checkbox" checked={cfg.sendImages} onChange={(e) => persistCfg({ ...cfg, sendImages: e.target.checked })} />发送图片（多模态）</label>
                        </>
                      )}
                      {setTab === "params" && (
                        <>
                          {([
                            ["temperature", "Temperature", 0, 2, 0.05, params.temperature],
                            ["topP", "Top P", 0, 1, 0.05, params.topP],
                            ["maxTokens", "Max Tokens", 256, 16000, 256, params.maxTokens],
                          ] as const).map(([key, lab, min, max, step, val]) => (
                            <label key={key} className="block text-neutral-400">
                              <div className="flex justify-between"><span>{lab}</span><span className="text-neutral-200">{val}</span></div>
                              <input type="range" min={min} max={max} step={step} value={val} className="w-full"
                                onChange={(e) => persistParams({ ...params, [key]: Number(e.target.value) })} />
                            </label>
                          ))}
                        </>
                      )}
                      {setTab === "preset" && (
                        <PresetEditor
                          preset={preset}
                          onChange={(p) => {
                            setPreset(p);
                            saveChatPreset(p);
                          }}
                          onImported={(p) => {
                            persistParams({
                              ...params,
                              temperature: p.temperature ?? params.temperature,
                              topP: p.topP ?? params.topP,
                            });
                            ping(`已导入 ${p.entries.length} 条 / ${(p.regexes || []).length} 正则`);
                          }}
                        />
                      )}
                      {setTab === "persona" && (
                        <>
                          <p className="text-neutral-500">测试用。正式请用角色卡当自己的人设（选玩家视角）。</p>
                          <label className="flex items-center gap-2 text-neutral-300">
                            <input type="checkbox" checked={!!session.useTestPersona} onChange={(e) => setSession((s) => ({ ...s, useTestPersona: e.target.checked }))} />
                            用测试人设当玩家
                          </label>
                          <input
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200"
                            placeholder="名称"
                            value={testPersona.name}
                            onChange={(e) => {
                              const n = { ...testPersona, name: e.target.value };
                              setTestPersona(n);
                              saveTestPersona(n);
                            }}
                          />
                          <textarea
                            className="w-full min-h-[120px] bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-200"
                            placeholder="测试人设正文"
                            value={testPersona.body}
                            onChange={(e) => {
                              const n = { ...testPersona, body: e.target.value };
                              setTestPersona(n);
                              saveTestPersona(n);
                            }}
                          />
                        </>
                      )}
                      {setTab === "types" && <RequestTypesPanel onPing={ping} />}
                      {setTab === "features" && (
                        <>
                          <label className="flex items-center gap-2 text-neutral-300">
                            <input type="checkbox" checked={!!session.autoImage} onChange={(e) => setSession((s) => ({ ...s, autoImage: e.target.checked }))} />
                            回复后用生图预设出图（默认关，每组一张）
                          </label>
                          <label className="flex items-center gap-2 text-neutral-300">
                            <input type="checkbox" checked={session.autoSummary} onChange={(e) => setSession((s) => ({ ...s, autoSummary: e.target.checked }))} />
                            每 5 次对话自动写入时间线（{unsummarizedUserCount(session.messages)}/5）
                          </label>
                          {canEditCard && (
                          <label className="flex items-center gap-2 text-neutral-300">
                            <input type="checkbox" checked={session.allowCardEdit !== false} onChange={(e) => setSession((s) => ({ ...s, allowCardEdit: e.target.checked }))} />
                            允许助手建议改角色卡（需确认后写入）
                          </label>
                          )}
                          {localOnly && <p className="text-neutral-500">分享页对话记忆只留在本机，不写时间线。</p>}
                          <p className="text-neutral-500">类似原版智绘姬帮改效果设定：补人设、按对话更新经历、生成外观提示词，点应用才会写进卡。</p>
                        </>
                      )}
                    </div>
                  </>
                )}

                {panel === "history" && (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {threads.length === 0 && <p className="text-xs text-neutral-600 p-3">还没有历史</p>}
                    {threads.map((t) => (
                      <div key={t.id} className={`flex items-center gap-2 rounded-xl px-2 py-2 text-xs ${t.id === session.id ? "bg-purple-950/50 border border-purple-800/40" : "hover:bg-white/5"}`}>
                        <button type="button" className="flex-1 text-left min-w-0" onClick={() => { setSession(t); setPanel("none"); }}>
                          <div className="text-neutral-200 truncate">{t.title || "对话"}</div>
                          <div className="text-neutral-600">{(t.updatedAt || "").slice(0, 16).replace("T", " ")} · {t.messages.length} 条</div>
                        </button>
                        <button type="button" className="text-rose-400 px-1" onClick={() => {
                          deleteChatThread(storeId, t.id);
                          if (t.id === session.id) setSession(emptySession(storeId));
                          refreshThreads(storeId);
                        }}>删</button>
                      </div>
                    ))}
                  </div>
                )}

                {panel === "summary" && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <button
                      type="button"
                      disabled={busy || unsummarizedUserCount(session.messages) === 0}
                      className="w-full text-xs py-1.5 rounded-lg border border-amber-800 text-amber-200 disabled:opacity-40"
                      onClick={() => void runSummary(session.messages).catch((e) => setError(e instanceof Error ? e.message : "总结失败"))}
                    >
                      总结当前未归档轮次
                    </button>
                    <p className="text-[11px] text-neutral-600">启用的总结会写进角色时间线；近期对话仍发给模型。</p>
                    {(session.summaries || []).length === 0 && <p className="text-xs text-neutral-600">还没有总结</p>}
                    {(session.summaries || []).map((s) => (
                      <div key={s.id} className="border border-neutral-800 rounded-xl p-2 text-xs">
                        <div className="text-purple-200">{s.title}</div>
                        <div className="text-neutral-500 mt-0.5">{s.names.join("、")}</div>
                        <div className="text-neutral-400 mt-1 whitespace-pre-wrap">{s.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {skillPending.length > 0 && panel === "none" && (
            <div className="px-3 py-2 border-t border-amber-900/50 bg-amber-950/40 text-[11px] max-h-40 overflow-y-auto space-y-1">
              <div className="text-amber-200">待确认的修改</div>
              {skillPending.map((ch) => (
                <div key={ch.id}>
                  <span className="text-amber-300">{ch.title}</span>
                  <div className="text-neutral-400 whitespace-pre-wrap">{ch.summary.slice(0, 280)}</div>
                </div>
              ))}
              <div className="flex gap-1">
                <button type="button" className="px-2 py-0.5 rounded bg-purple-600 text-white" onClick={() => applySkillPending(skillPending)}>应用全部</button>
                <button type="button" className="px-2 py-0.5 rounded border border-neutral-600" onClick={() => setSkillPending([])}>忽略</button>
              </div>
            </div>
          )}
          {error && panel === "none" && <div className="px-3 text-[11px] text-rose-400">{error}</div>}

          <div className="border-t border-neutral-800 p-2 space-y-1.5">
            <div className="flex flex-wrap gap-1 px-1">
              {worldMates.slice(0, 12).map((c) => {
                const on = session.participantIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => {
                      setSession((s) => {
                        const ids = on ? s.participantIds.filter((id) => id !== c.id) : [...s.participantIds, c.id];
                        const nextIds = ids.length ? ids : [host.id];
                        return { ...s, participantIds: nextIds, povId: nextIds.includes(s.povId) ? s.povId : nextIds[0]! };
                      });
                    }}
                    className={`rounded-full ${on ? "ring-2 ring-purple-400" : "opacity-40"}`}
                  >
                    <Avatar src={c.avatar} name={c.name} size={22} />
                  </button>
                );
              })}
              {solo ? (
                <span className="ml-auto text-[10px] text-neutral-500">你是{voiceName}</span>
              ) : (
                <select
                  className="ml-auto bg-transparent text-[10px] text-neutral-400 max-w-[7rem]"
                  value={session.povId}
                  onChange={(e) => setSession((s) => ({ ...s, povId: e.target.value }))}
                >
                  {present.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {solo && (
                <select
                  className="bg-transparent text-[10px] text-neutral-400"
                  value={session.soloMode}
                  onChange={(e) => setSession((s) => ({ ...s, soloMode: e.target.value as SoloMode }))}
                >
                  <option value="mystery">神秘声音</option>
                  <option value="monologue">脑内的声音</option>
                </select>
              )}
            </div>
            {image && (
              <div className="relative w-16 ml-1">
                <img src={image} alt="" className="h-12 rounded-lg object-cover" />
                <button type="button" className="absolute -top-1 -right-1 w-4 h-4 bg-black/70 rounded-full text-[10px] text-white" onClick={() => setImage(null)}>×</button>
              </div>
            )}
            {session.allowCardEdit !== false && (
              <div className="flex flex-wrap gap-1 px-1">
                {shortcuts.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={busy}
                    className="px-2 py-0.5 rounded-full border border-neutral-700 text-[10px] text-neutral-300 disabled:opacity-40"
                    onClick={() => void send(s.prompt)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1">
              <button
                type="button"
                title={session.autoImage ? "生图开" : "生图关"}
                className={`w-9 h-9 rounded-full text-sm ${session.autoImage ? "bg-purple-600 text-white" : "text-neutral-400 hover:bg-white/10"}`}
                onClick={() => setSession((s) => ({ ...s, autoImage: !s.autoImage }))}
              >
                图
              </button>
              <button type="button" title="添加图片" className="w-9 h-9 rounded-full text-neutral-400 hover:bg-white/10" onClick={() => imgRef.current?.click()}>🖼</button>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setImage(String(r.result || ""));
                r.readAsDataURL(f);
              }} />
              <textarea
                rows={1}
                className="flex-1 bg-[#1c1c20] border border-neutral-700 rounded-2xl px-3 py-2 text-sm text-neutral-200 resize-none max-h-24"
                placeholder="输入… (Enter 发送)"
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
                <button type="button" className="w-9 h-9 rounded-full bg-neutral-700 text-white text-xs" onClick={() => abortRef.current?.abort()}>停</button>
              ) : (
                <>
                  {lastAsstId && (
                    <button type="button" className="w-9 h-9 rounded-full border border-neutral-700 text-neutral-300" title="重新生成" onClick={regenLast}>↻</button>
                  )}
                  <button type="button" disabled={!draft.trim() && !image} className="w-9 h-9 rounded-full bg-purple-600 text-white disabled:opacity-40" onClick={() => void send()}>➤</button>
                </>
              )}
            </div>
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
          canSave={canEditCard && !localOnly}
          onSave={() => void saveToGallery(preview.url, preview.charId)}
          onClose={() => setPreview(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-white text-black text-sm">
          {toast}
        </div>
      )}
    </>
  );
}