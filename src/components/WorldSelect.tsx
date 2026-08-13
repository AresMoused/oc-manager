"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  worlds: string[];
  onChange: (world: string) => void;
  onCreateWorld?: (world: string) => void;
  editable?: boolean;
}

/**
 * Prominent world/setting selector. Creating a new world initializes its option catalog.
 */
export default function WorldSelect({
  value,
  worlds,
  onChange,
  onCreateWorld,
  editable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editable) {
    return value ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/40 text-purple-300 text-xs border border-purple-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        {value}
      </span>
    ) : (
      <span className="text-xs text-neutral-500">未指定世界</span>
    );
  }

  const filtered = worlds.filter((w) =>
    w.toLowerCase().includes(query.toLowerCase())
  );
  const canCreate =
    query.trim() &&
    !worlds.some((w) => w.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 text-xs border border-purple-700/50 transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        {value || "选择世界 / Setting"}
        <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 left-0 top-full mt-1 w-56 bg-[#1a1a1a] border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-neutral-800">
            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs outline-none focus:border-purple-500"
              placeholder="搜索或新建世界..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  const w = query.trim();
                  onCreateWorld?.(w);
                  onChange(w);
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
              >
                清除世界
              </button>
            )}
            {filtered.map((w) => (
              <button
                key={w}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-purple-900/40 ${
                  w === value ? "text-purple-300 bg-purple-900/20" : "text-neutral-300"
                }`}
                onClick={() => {
                  onChange(w);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {w}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-900/30 border-t border-neutral-800"
                onClick={() => {
                  const w = query.trim();
                  onCreateWorld?.(w);
                  onChange(w);
                  setOpen(false);
                  setQuery("");
                }}
              >
                + 创建世界 “{query.trim()}”
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-3 py-2 text-xs text-neutral-500">无匹配世界</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
