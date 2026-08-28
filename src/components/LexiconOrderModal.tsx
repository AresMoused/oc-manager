"use client";

import { useEffect, useState } from "react";

export type OrderItem = { id: string; label: string };

export default function LexiconOrderModal({
  open,
  items,
  onClose,
  onChange,
}: {
  open: boolean;
  items: OrderItem[];
  onClose: () => void;
  onChange: (ids: string[]) => void;
}) {
  const [rows, setRows] = useState<OrderItem[]>(items);
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    if (open) setRows(items);
  }, [open, items]);

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const next = [...rows];
    const [hit] = next.splice(from, 1);
    if (!hit) return;
    next.splice(to, 0, hit);
    setRows(next);
    onChange(next.map((r) => r.id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-white font-semibold">启动列表排列</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              从上到下写入提示词。可拖动或用箭头调整。
            </p>
          </div>
          <button type="button" className="text-neutral-400 text-sm" onClick={onClose}>关闭</button>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-500">还没有启动的列表</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((row, i) => (
              <li
                key={row.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag == null) return;
                  move(drag, i);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                  drag === i
                    ? "border-purple-600 bg-purple-950/30"
                    : "border-neutral-800 bg-[#0c0c0c]"
                }`}
              >
                <span className="text-neutral-600 cursor-grab select-none" title="拖动">☰</span>
                <span className="text-neutral-500 w-5 tabular-nums">{i + 1}</span>
                <span className="flex-1 text-neutral-200 truncate">{row.label}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30"
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === rows.length - 1}
                  className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30"
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm px-3 py-1 rounded-lg bg-purple-600 text-white"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}