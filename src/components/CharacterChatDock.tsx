"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, TimelineEvent } from "@/lib/types";
import type { AiApiConfig, AiModelParams } from "@/lib/aiConfig";
import { completeChat, fetchModels } from "@/lib/aiConfig";
import {
  type ChatPresetFile,
  type ChatSession,
  type ChatTurn,
  type SoloMode,
  buildChatMessages,
  buildSummaryMessages,
  displayReply,
  emptySession,
  loadChatApiConfig,
  loadChatParams,
  loadChatPreset,
  loadChatSession,
  parseSillyTavernPreset,
  parseSummaryJson,
  recentUnsummarized,
  saveChatApiConfig,
  saveChatParams,
  saveChatPreset,
  saveChatSession,
  toTimelineEvent,
  unsummarizedUserCount,
} from "@/lib/characterChat";

export default function CharacterChatDock({
  host,
  characters,
  onWriteTimeline,
}: {
  host: Character;
  characters: Character[];
  onWriteTimeline: (charIds: string[], event: Omit<TimelineEvent, "id">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [cfg, setCfg] = useState<AiApiConfig>(() => loadChatApiConfig());
  const [params, setParams] = useState<AiModelParams>(() => loadChatParams());
  const [preset, setPreset] = useState<ChatPresetFile | null>(null);
  const [session, setSession] = useState<ChatSession>(() => emptySession(host.id));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showKey, setShowKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const worldMates = useMemo(() => {
    const same = characters.filter((c) => c.world && c.world === host.world);
    return same.length ? same : characters;
  }, [characters, host.world]);

  useEffect(() => {
    setPreset(loadChatPreset());
    const saved = loadChatSession(host.id);
    setSession(
      saved
        ? {
            ...emptySession(host.id),
            ...saved,
            hostId: host.id,
            participantIds: saved.participantIds?.length ? saved.participantIds : [host.id],
            povId: saved.povId || host.id,
          }
        : emptySession(host.id)
    );
  }, [host.id]);

  useEffect(() => {
    saveChatSession(session);
  }, [session]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session.messages, busy]);

  const present = worldMates.filter((c) => session.participantIds.includes(c.id));
  const pov = present.find((c) => c.id === session.povId) || present[0] || host;
  const solo = present.length <= 1;
  const ping = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const persistCfg = (next: AiApiConfig) => {
    setCfg(next);
    saveChatApiConfig(next);
  };
  const persistParams = (next: AiModelParams) => {
    setParams(next);
    saveChatParams(next);
  };

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
      });
      const parsed = parseSummaryJson(raw);
      if (!parsed) throw new Error("总结解析失败");
      const ev = toTimelineEvent(parsed, names);
      onWriteTimeline(
        present.map((c) => c.id),
        ev
      );
      setSession((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          pending.some((p) => p.id === m.id) ? { ...m, summarized: true } : m
        ),
      }));
      ping("已写入在场角色时间线");
    },
    [cfg, params, present, solo, session.soloMode, pov.name, onWriteTimeline]
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!cfg.apiKey.trim() || !cfg.baseUrl.trim()) {
      setError("请先在设置里填写对话 API");
      setSettings(true);
      return;
    }
    if (!preset) {
      setError("请先导入对话预设文件");
      setSettings(true);
      return;
    }
    setError("");
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      speakerId: pov.id,
      speakerName: pov.name,
      content: text,
      at: new Date().toISOString(),
    };
    const nextMsgs = [...session.messages, userTurn];
    setSession((s) => ({ ...s, messages: nextMsgs }));
    setDraft("");
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const asstId = crypto.randomUUID();
    setSession((s) => ({
      ...s,
      messages: [
        ...s.messages.filter((m) => m.id !== asstId),
        {
          id: asstId,
          role: "assistant",
          speakerName: solo
            ? session.soloMode === "mystery"
              ? "神秘声音"
              : "独白"
            : present.filter((c) => c.id !== pov.id).map((c) => c.name).join("、") || "对方",
          content: "",
          at: new Date().toISOString(),
        },
      ],
    }));
    try {
      const messages = buildChatMessages({
        preset,
        present: present.length ? present : [host],
        pov,
        soloMode: session.soloMode,
        scene: session.scene,
        history: nextMsgs,
        userLine: text,
      });
      const raw = await completeChat({
        config: cfg,
        params,
        messages,
        signal: ac.signal,
        onDelta: (full) => {
          setSession((s) => ({
            ...s,
            messages: s.messages.map((m) => (m.id === asstId ? { ...m, content: full } : m)),
          }));
        },
      });
      let finalMsgs: ChatTurn[] = [];
      setSession((s) => {
        finalMsgs = s.messages.map((m) => (m.id === asstId ? { ...m, content: raw } : m));
        return { ...s, messages: finalMsgs };
      });
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[70] px-4 py-2.5 rounded-full bg-purple-600 text-white text-sm shadow-lg hover:bg-purple-500"
      >
        对话
      </button>

      {open && (
        <div className="fixed inset-0 z-[75] flex justify-end bg-black/50">
          <button type="button" className="flex-1 cursor-default" aria-label="关闭" onClick={() => setOpen(false)} />
          <div className="w-full max-w-lg h-full bg-[#0c0c0c] border-l border-neutral-800 flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">角色对话</div>
                <div className="text-[11px] text-neutral-500 truncate">
                  视角 {pov.name}
                  {solo ? ` · ${session.soloMode === "mystery" ? "神秘声音" : "独白"}` : ` · 在场 ${present.length}`}
                </div>
              </div>
              <button type="button" className="text-xs text-neutral-400 border border-neutral-700 rounded px-2 py-1" onClick={() => setSettings((v) => !v)}>
                {settings ? "返回" : "设置"}
              </button>
              <button type="button" className="text-neutral-400 text-sm" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>

            {settings ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                <section className="space-y-2">
                  <div className="text-xs text-amber-200/90 font-medium">对话 API（与 AI 生成角色分开）</div>
                  <input
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs font-mono"
                    placeholder="https://api.deepseek.com"
                    value={cfg.baseUrl}
                    onChange={(e) => persistCfg({ ...cfg, baseUrl: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs font-mono"
                      placeholder="API Key"
                      type={showKey ? "text" : "password"}
                      value={cfg.apiKey}
                      onChange={(e) => persistCfg({ ...cfg, apiKey: e.target.value })}
                    />
                    <button type="button" className="text-[11px] text-neutral-400" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? "隐藏" : "显示"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs font-mono"
                      placeholder="模型名"
                      value={cfg.model}
                      onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}
                    />
                    <button
                      type="button"
                      className="text-[11px] px-2 border border-neutral-700 rounded text-neutral-300"
                      onClick={async () => {
                        try {
                          const ids = await fetchModels(cfg.baseUrl, cfg.apiKey);
                          persistCfg({ ...cfg, models: ids });
                          ping(`拉到 ${ids.length} 个模型`);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "拉模型失败");
                        }
                      }}
                    >
                      拉模型
                    </button>
                  </div>
                  {!!cfg.models?.length && (
                    <select
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs"
                      value={cfg.model}
                      onChange={(e) => persistCfg({ ...cfg, model: e.target.value })}
                    >
                      {cfg.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input type="checkbox" checked={cfg.stream} onChange={(e) => persistCfg({ ...cfg, stream: e.target.checked })} />
                    流式输出
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-neutral-400">
                    <label>温度
                      <input type="number" step="0.1" className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                        value={params.temperature} onChange={(e) => persistParams({ ...params, temperature: Number(e.target.value) })} />
                    </label>
                    <label>top_p
                      <input type="number" step="0.05" className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                        value={params.topP} onChange={(e) => persistParams({ ...params, topP: Number(e.target.value) })} />
                    </label>
                    <label>max
                      <input type="number" className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                        value={params.maxTokens} onChange={(e) => persistParams({ ...params, maxTokens: Number(e.target.value) })} />
                    </label>
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="text-xs text-amber-200/90 font-medium">对话预设</div>
                  <p className="text-[11px] text-neutral-500">导入 SillyTavern Chat Completion JSON。开启状态默认跟文件走，可在下面改。</p>
                  <div className="flex gap-2">
                    <button type="button" className="text-xs px-2 py-1 rounded border border-sky-800 text-sky-300" onClick={() => fileRef.current?.click()}>
                      导入预设
                    </button>
                    {preset && (
                      <button type="button" className="text-xs text-rose-400" onClick={() => { saveChatPreset(null); setPreset(null); }}>
                        清除
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        const parsed = parseSillyTavernPreset(await f.text());
                        saveChatPreset(parsed);
                        setPreset(parsed);
                        if (parsed.temperature != null || parsed.topP != null) {
                          persistParams({
                            ...params,
                            temperature: parsed.temperature ?? params.temperature,
                            topP: parsed.topP ?? params.topP,
                          });
                        }
                        ping(`已导入 ${parsed.entries.length} 条`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "导入失败");
                      }
                    }}
                  />
                  {preset ? (
                    <div className="space-y-1">
                      <div className="text-[11px] text-neutral-400">{preset.name} · {preset.entries.filter((x) => x.enabled).length}/{preset.entries.length} 开启</div>
                      {preset.entries.map((ent) => (
                        <label key={ent.id} className="flex items-start gap-2 text-[11px] border border-neutral-800 rounded px-2 py-1">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={ent.enabled}
                            onChange={() => {
                              const next = {
                                ...preset,
                                entries: preset.entries.map((x) =>
                                  x.id === ent.id ? { ...x, enabled: !x.enabled } : x
                                ),
                              };
                              setPreset(next);
                              saveChatPreset(next);
                            }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="text-neutral-200">{ent.name}</span>
                            <span className="text-neutral-600 ml-1">{ent.role}{ent.marker ? " · 槽位" : ""}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-600">还没有预设。把小猫之神那种 ST 预设 JSON 导进来。</p>
                  )}
                </section>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-neutral-800 space-y-2 text-[11px]">
                  <div>
                    <div className="text-neutral-500 mb-1">在场角色</div>
                    <div className="flex flex-wrap gap-1">
                      {worldMates.map((c) => {
                        const on = session.participantIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={`px-2 py-0.5 rounded-full border ${on ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-400"}`}
                            onClick={() => {
                              setSession((s) => {
                                const ids = on
                                  ? s.participantIds.filter((id) => id !== c.id)
                                  : [...s.participantIds, c.id];
                                const nextIds = ids.length ? ids : [host.id];
                                const povId = nextIds.includes(s.povId) ? s.povId : nextIds[0]!;
                                return { ...s, participantIds: nextIds, povId };
                              });
                            }}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-neutral-500">玩家视角</span>
                    <select
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                      value={session.povId}
                      onChange={(e) => setSession((s) => ({ ...s, povId: e.target.value }))}
                    >
                      {present.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {solo && (
                      <>
                        <span className="text-neutral-500">对手</span>
                        <select
                          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                          value={session.soloMode}
                          onChange={(e) => setSession((s) => ({ ...s, soloMode: e.target.value as SoloMode }))}
                        >
                          <option value="mystery">某处来的神秘声音</option>
                          <option value="monologue">独白 / 环境</option>
                        </select>
                      </>
                    )}
                  </div>
                  <input
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-300"
                    placeholder="场景（可选）"
                    value={session.scene}
                    onChange={(e) => setSession((s) => ({ ...s, scene: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-neutral-400">
                    <input
                      type="checkbox"
                      checked={session.autoSummary}
                      onChange={(e) => setSession((s) => ({ ...s, autoSummary: e.target.checked }))}
                    />
                    每 5 次对话自动写入时间线
                    <span className="text-neutral-600">未总结 {unsummarizedUserCount(session.messages)}/5</span>
                  </label>
                </div>

                <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {session.messages.length === 0 && (
                    <p className="text-xs text-neutral-600 text-center py-10">用 {pov.name} 的视角说第一句话。</p>
                  )}
                  {session.messages.map((m) => (
                    <div key={m.id} className={`text-sm whitespace-pre-wrap ${m.role === "user" ? "text-sky-200" : "text-neutral-200"}`}>
                      <div className="text-[10px] text-neutral-500 mb-0.5">
                        {m.role === "user" ? m.speakerName : m.speakerName}
                        {m.summarized ? " · 已记入时间线" : ""}
                      </div>
                      {m.role === "assistant" ? displayReply(m.content) || (busy ? "…" : "") : m.content}
                    </div>
                  ))}
                </div>

                {error && <div className="px-4 text-[11px] text-rose-400">{error}</div>}

                <div className="p-3 border-t border-neutral-800 space-y-2">
                  <textarea
                    className="w-full min-h-[72px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200 resize-y"
                    placeholder={`以 ${pov.name} 说话…`}
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
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={busy || !draft.trim()} className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white disabled:opacity-40" onClick={() => void send()}>
                      发送
                    </button>
                    {busy && (
                      <button type="button" className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300" onClick={() => abortRef.current?.abort()}>
                        停止
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || unsummarizedUserCount(session.messages) === 0}
                      className="px-3 py-1.5 text-sm rounded-lg border border-amber-800 text-amber-200 disabled:opacity-40"
                      onClick={() => void runSummary(session.messages).catch((e) => setError(e instanceof Error ? e.message : "总结失败"))}
                    >
                      现在总结
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-400"
                      onClick={() => {
                        if (!window.confirm("清空本场对话？时间线不会删。")) return;
                        setSession((s) => ({ ...s, messages: [] }));
                      }}
                    >
                      清空本场
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-white text-black text-sm">
          {toast}
        </div>
      )}
    </>
  );
}