"use client";

import { useState } from "react";
import { StoredPrompt } from "@/lib/types";
import SectionHeader from "./SectionHeader";

interface Props {
  prompts: StoredPrompt[];
  onChange: (prompts: StoredPrompt[]) => void;
  editable?: boolean;
}

export default function PromptBank({
  prompts,
  onChange,
  editable = true,
}: Props) {
  const [draft, setDraft] = useState("");
  const [label, setLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([
      ...prompts,
      {
        id: crypto.randomUUID(),
        text,
        label: label.trim() || "提示词",
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setLabel("");
    setShowForm(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("已复制");
      setTimeout(() => setToast(""), 1500);
    } catch {
      setToast("复制失败");
      setTimeout(() => setToast(""), 1500);
    }
  };

  return (
    <div className="mb-4">
      <SectionHeader
        title="提示词库 / Prompts"
        onAdd={editable ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md p-3 space-y-2">
        {showForm && editable && (
          <div className="p-3 bg-[#0a0a0a] border border-purple-800/40 rounded-lg space-y-2 mb-2">
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              placeholder="标签（可选）"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <textarea
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono outline-none focus:border-purple-500 min-h-[72px]"
              placeholder="1girl, blonde hair, ..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-sm text-neutral-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={add}
                className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {prompts.length === 0 ? (
          <p className="text-neutral-600 text-sm text-center py-4">
            暂无提示词 · 可从「角色生成器」导入，或手动添加
          </p>
        ) : (
          prompts.map((p) => (
            <div
              key={p.id}
              className="group relative border border-neutral-800 rounded-lg p-3 bg-[#0c0c0c]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-purple-400 font-medium">
                  {p.label || "提示词"}
                </span>
                <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => copy(p.text)}
                    className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-white"
                  >
                    复制
                  </button>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(prompts.filter((x) => x.id !== p.id))
                      }
                      className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-rose-400/80 hover:text-rose-300"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              <p className="font-mono text-[11px] text-neutral-400 break-all leading-relaxed">
                {p.text}
              </p>
            </div>
          ))
        )}
        {toast && (
          <p className="text-center text-xs text-emerald-400">{toast}</p>
        )}
      </div>
    </div>
  );
}
