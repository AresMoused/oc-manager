"use client";

import { useState } from "react";
import type { BuilderSection } from "@/lib/promptBuilder";
import {
  type PromptToken,
  tokenLabel,
  tokenPromptText,
} from "@/lib/lexicon";

function moveToken(list: PromptToken[], fromId: string, toId: string): PromptToken[] {
  if (fromId === toId) return list;
  const from = list.findIndex((t) => t.id === fromId);
  const to = list.findIndex((t) => t.id === toId);
  if (from < 0 || to < 0) return list;
  const next = [...list];
  const [hit] = next.splice(from, 1);
  if (!hit) return list;
  next.splice(to, 0, hit);
  return next;
}

const box =
  "w-full bg-[#111] border border-neutral-800 rounded-lg px-2 py-2 text-xs overflow-auto resize-y min-h-[52px]";

export default function PromptTokenBoxes({
  tokens,
  sections,
  selected,
  prompt,
  onReorder,
}: {
  tokens: PromptToken[];
  sections: BuilderSection[];
  selected: Record<string, number>;
  prompt: string;
  onReorder: (next: PromptToken[]) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const dropOn = (id: string) => {
    if (!drag) return;
    onReorder(moveToken(tokens, drag, id));
    setDrag(null);
  };

  return (
    <div className="flex-1 space-y-1.5 min-w-0">
      <div
        className={`${box} font-mono text-neutral-400 max-h-40`}
        title="英文 tag · 可拖动排序 · 右下角拉高"
      >
        {tokens.length === 0 ? (
          <span className="text-neutral-600">（未选择）</span>
        ) : (
          tokens.map((t) => {
            const text = tokenPromptText(t, sections, selected);
            if (!text) return null;
            const on = hover === t.id;
            return (
              <span
                key={t.id}
                draggable
                onDragStart={() => setDrag(t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(t.id)}
                onDragEnd={() => setDrag(null)}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover((h) => (h === t.id ? null : h))}
                className={`cursor-grab rounded px-0.5 ${
                  on ? "bg-yellow-300 text-black" : drag === t.id ? "opacity-40" : ""
                }`}
              >
                {text}
              </span>
            );
          })
        )}
      </div>
      <div
        className={`${box} max-h-40`}
        title="中文标签 · 与上框一一对应 · 可拖动 · 右下角拉高"
      >
        {tokens.length === 0 ? (
          <span className="text-neutral-600">（未选择）</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tokens.map((t) => {
              const label = tokenLabel(t, sections, selected);
              const on = hover === t.id;
              return (
                <span
                  key={t.id}
                  draggable
                  onDragStart={() => setDrag(t.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(t.id)}
                  onDragEnd={() => setDrag(null)}
                  onMouseEnter={() => setHover(t.id)}
                  onMouseLeave={() => setHover((h) => (h === t.id ? null : h))}
                  className={`cursor-grab select-none px-2 py-0.5 rounded-full border text-[11px] ${
                    t.kind === "fixed"
                      ? "border-neutral-600 text-neutral-400"
                      : "border-purple-800/60 text-purple-200"
                  } ${on ? "bg-yellow-300 text-black border-yellow-400" : ""} ${
                    drag === t.id ? "opacity-40" : ""
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <p className="sr-only">{prompt}</p>
    </div>
  );
}