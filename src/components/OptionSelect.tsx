"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreateOption?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Combobox: pick from existing options or type a new one (auto-saved to catalog).
 */
export default function OptionSelect({
  label,
  value,
  options,
  onChange,
  onCreateOption,
  placeholder = "",
  editable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  if (!editable) {
    return (
      <div className="flex gap-2 items-center">
        <span className="w-14 text-neutral-500 shrink-0">{label}:</span>
        <span className="text-neutral-200">{value || "—"}</span>
      </div>
    );
  }

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );
  const canCreate =
    query.trim() &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const commit = (v: string) => {
    const trimmed = v.trim();
    onChange(trimmed);
    if (canCreate && trimmed && onCreateOption) {
      onCreateOption(trimmed);
    }
    setQuery(trimmed);
    setOpen(false);
  };

  return (
    <div className="flex gap-2 items-center relative" ref={ref}>
      <span className="w-14 text-neutral-500 shrink-0">{label}:</span>
      <div className="flex-1 relative">
        <input
          className="w-full bg-transparent border-b border-neutral-700 focus:border-purple-500 outline-none px-1 py-0.5 text-neutral-200"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(query);
            }
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(value);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (query !== value) commit(query);
            }, 150);
          }}
        />
        {open && (filtered.length > 0 || canCreate) && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-[#1a1a1a] border border-neutral-700 rounded-md shadow-xl">
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                className={`w-full text-left px-2 py-1.5 text-sm hover:bg-purple-900/40 ${
                  o === value ? "text-purple-300" : "text-neutral-300"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
              >
                {o}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm text-emerald-400 hover:bg-emerald-900/30 border-t border-neutral-800"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(query);
                }}
              >
                + 创建 “{query.trim()}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
