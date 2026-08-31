"use client";

import { useState } from "react";
import type { ChatPresetFile, ChatPromptEntry } from "@/lib/characterChat";
import { parseSillyTavernPreset } from "@/lib/characterChat";
import { newRegex, type ChatRegex } from "@/lib/chatRegex";

export default function PresetEditor({
  preset,
  onChange,
  onImported,
}: {
  preset: ChatPresetFile | null;
  onChange: (next: ChatPresetFile | null) => void;
  onImported?: (p: ChatPresetFile) => void;
}) {
  const [tab, setTab] = useState<"entries" | "regex">("entries");
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = { current: null as HTMLInputElement | null };

  const save = (next: ChatPresetFile) => onChange(next);

  return (
    <div className="space-y-2 text-xs">
      <p className="text-neutral-500">导入 SillyTavern Chat Completion JSON。条目和正则默认跟文件走，可开关、可加减。</p>
      <div className="flex gap-2">
        <button type="button" className="px-2 py-1 rounded-lg border border-sky-800 text-sky-300" onClick={() => fileRef.current?.click()}>
          导入预设
        </button>
        {preset && (
          <button type="button" className="text-rose-400" onClick={() => onChange(null)}>
            清除
          </button>
        )}
      </div>
      <input
        ref={(el) => {
          fileRef.current = el;
        }}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const parsed = parseSillyTavernPreset(await f.text());
          onChange(parsed);
          onImported?.(parsed);
        }}
      />
      {!preset ? (
        <p className="text-neutral-600">还没有对话预设</p>
      ) : (
        <>
          <div className="text-neutral-400">{preset.name} · 条目 {preset.entries.filter((x) => x.enabled).length}/{preset.entries.length} · 正则 {(preset.regexes || []).filter((x) => x.enabled).length}/{(preset.regexes || []).length}</div>
          <div className="flex border border-neutral-800 rounded-lg overflow-hidden">
            <button type="button" className={`flex-1 py-1 ${tab === "entries" ? "bg-neutral-800 text-white" : "text-neutral-500"}`} onClick={() => setTab("entries")}>条目</button>
            <button type="button" className={`flex-1 py-1 ${tab === "regex" ? "bg-neutral-800 text-white" : "text-neutral-500"}`} onClick={() => setTab("regex")}>正则</button>
          </div>

          {tab === "entries" && (
            <div className="space-y-1">
              {preset.entries.map((ent) => (
                <div key={ent.id} className="border border-neutral-800 rounded-lg px-2 py-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ent.enabled}
                      onChange={() =>
                        save({
                          ...preset,
                          entries: preset.entries.map((x) =>
                            x.id === ent.id ? { ...x, enabled: !x.enabled } : x
                          ),
                        })
                      }
                    />
                    <button type="button" className="flex-1 text-left text-neutral-200 truncate" onClick={() => setOpenId(openId === ent.id ? null : ent.id)}>
                      {ent.name}
                      <span className="text-neutral-600 ml-1">{ent.marker ? "槽位" : ent.role}</span>
                    </button>
                    <button
                      type="button"
                      className="text-rose-400"
                      onClick={() =>
                        save({ ...preset, entries: preset.entries.filter((x) => x.id !== ent.id) })
                      }
                    >
                      删
                    </button>
                  </div>
                  {openId === ent.id && (
                    <div className="mt-1 space-y-1">
                      <input
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200"
                        value={ent.name}
                        onChange={(e) =>
                          save({
                            ...preset,
                            entries: preset.entries.map((x) =>
                              x.id === ent.id ? { ...x, name: e.target.value } : x
                            ),
                          })
                        }
                      />
                      <textarea
                        className="w-full min-h-[80px] bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-neutral-200 font-mono"
                        value={ent.content}
                        onChange={(e) =>
                          save({
                            ...preset,
                            entries: preset.entries.map((x) =>
                              x.id === ent.id ? { ...x, content: e.target.value } : x
                            ),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-sky-300"
                onClick={() => {
                  const e: ChatPromptEntry = {
                    id: crypto.randomUUID(),
                    identifier: "",
                    name: "新条目",
                    role: "system",
                    content: "",
                    enabled: true,
                    marker: false,
                  };
                  save({ ...preset, entries: [...preset.entries, e] });
                  setOpenId(e.id);
                }}
              >
                + 条目
              </button>
            </div>
          )}

          {tab === "regex" && (
            <div className="space-y-1">
              {(preset.regexes || []).map((r) => (
                <RegexRow
                  key={r.id}
                  r={r}
                  open={openId === r.id}
                  onOpen={() => setOpenId(openId === r.id ? null : r.id)}
                  onChange={(next) =>
                    save({
                      ...preset,
                      regexes: (preset.regexes || []).map((x) => (x.id === r.id ? next : x)),
                    })
                  }
                  onDelete={() =>
                    save({ ...preset, regexes: (preset.regexes || []).filter((x) => x.id !== r.id) })
                  }
                />
              ))}
              <button
                type="button"
                className="text-sky-300"
                onClick={() => {
                  const r = newRegex();
                  save({ ...preset, regexes: [...(preset.regexes || []), r] });
                  setOpenId(r.id);
                }}
              >
                + 正则
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RegexRow({
  r,
  open,
  onOpen,
  onChange,
  onDelete,
}: {
  r: ChatRegex;
  open: boolean;
  onOpen: () => void;
  onChange: (r: ChatRegex) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg px-2 py-1">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={r.enabled} disabled={r.incompatible} onChange={() => onChange({ ...r, enabled: !r.enabled })} />
        <button type="button" className="flex-1 text-left text-neutral-200 truncate" onClick={onOpen}>
          {r.name}
          {r.incompatible && <span className="text-amber-500 ml-1">不兼容</span>}
          {r.promptOnly && <span className="text-neutral-600 ml-1">提示词</span>}
          {r.markdownOnly && <span className="text-neutral-600 ml-1">显示</span>}
        </button>
        <button type="button" className="text-rose-400" onClick={onDelete}>删</button>
      </div>
      {open && (
        <div className="mt-1 space-y-1">
          <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1" value={r.name} onChange={(e) => onChange({ ...r, name: e.target.value })} />
          <textarea className="w-full min-h-[48px] bg-neutral-900 border border-neutral-700 rounded px-1 py-1 font-mono" placeholder="find /pattern/g" value={r.find} onChange={(e) => onChange({ ...r, find: e.target.value })} />
          <textarea className="w-full min-h-[48px] bg-neutral-900 border border-neutral-700 rounded px-1 py-1 font-mono" placeholder="replace" value={r.replace} onChange={(e) => onChange({ ...r, replace: e.target.value })} />
          <label className="flex items-center gap-1 text-neutral-400">
            <input type="checkbox" checked={r.promptOnly} onChange={() => onChange({ ...r, promptOnly: !r.promptOnly })} />
            只改发给模型的文本
          </label>
          <label className="flex items-center gap-1 text-neutral-400">
            <input type="checkbox" checked={r.markdownOnly} onChange={() => onChange({ ...r, markdownOnly: !r.markdownOnly })} />
            只改显示
          </label>
        </div>
      )}
    </div>
  );
}