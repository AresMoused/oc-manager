"use client";

import { useMemo } from "react";
import {
  collectFilterTags,
  listMatchesFilter,
  type LexiconCategory,
  type LexiconListMeta,
} from "@/lib/lexicon";

export type CatalogCat = {
  id: string;
  label: string;
  lists: (LexiconListMeta & { local?: boolean })[];
};

export function LexiconFilterBar({
  cats,
  active,
  onChange,
}: {
  cats: CatalogCat[];
  active: string[];
  onChange: (next: string[]) => void;
}) {
  const allTags = useMemo(
    () => collectFilterTags(cats.flatMap((c) => c.lists)),
    [cats]
  );
  const untagged = cats.some((c) => c.lists.some((l) => !(l.filterTags || []).length));
  const toggle = (tag: string) => {
    if (tag === "") {
      onChange([]);
      return;
    }
    onChange(
      active.includes(tag) ? active.filter((t) => t !== tag) : [...active, tag]
    );
  };
  const chip = (key: string, label: string, on: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => toggle(key)}
      className={`px-2 py-0.5 text-[11px] rounded-full border ${
        on
          ? "border-sky-600 text-sky-200 bg-sky-950/40"
          : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
      }`}
    >
      {label}
    </button>
  );
  if (!allTags.length && !untagged) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-neutral-500 mr-0.5">过滤（列表标签需全部开启）</span>
      {chip("", "全部", active.length === 0)}
      {untagged && chip("__none__", "未分组", active.includes("__none__"))}
      {allTags.map((t) => chip(t, t, active.includes(t)))}
    </div>
  );
}

export function LexiconCatalogBody({
  cats,
  enabledIds,
  openCats,
  onToggleCat,
  onToggleList,
  activeFilter,
}: {
  cats: CatalogCat[];
  enabledIds: string[];
  openCats: Record<string, boolean>;
  onToggleCat: (id: string) => void;
  onToggleList: (id: string) => void;
  activeFilter: string[];
}) {
  const visible = useMemo(() => {
    return cats
      .map((c) => ({
        ...c,
        lists: c.lists.filter((l) => listMatchesFilter(l, activeFilter)),
      }))
      .filter((c) => c.lists.length > 0);
  }, [cats, activeFilter]);

  if (!visible.length) {
    return <p className="text-xs text-neutral-500">没有符合过滤条件的词库</p>;
  }

  return (
    <div className="space-y-2">
      {visible.map((cat) => (
        <div key={cat.id}>
          <button
            type="button"
            className="text-xs text-neutral-300 mb-1"
            onClick={() => onToggleCat(cat.id)}
          >
            {openCats[cat.id] !== false ? "▼" : "▶"} {cat.label}
            <span className="text-neutral-600 ml-1">
              {cat.lists.filter((l) => enabledIds.includes(l.id)).length}/{cat.lists.length}
            </span>
          </button>
          {openCats[cat.id] !== false && (
            <div className="flex flex-wrap gap-2 pl-3">
              {cat.lists.map((li) => {
                const on = enabledIds.includes(li.id);
                return (
                  <button
                    key={li.id}
                    type="button"
                    onClick={() => onToggleList(li.id)}
                    title={(li.filterTags || []).join(" · ") || undefined}
                    className={`px-2.5 py-1 text-xs rounded-lg border ${
                      on
                        ? "border-emerald-700 text-emerald-200 bg-emerald-950/30"
                        : "border-neutral-800 text-neutral-500"
                    }`}
                  >
                    {on ? "✓ " : "○ "}
                    {li.label}
                    {(li.filterTags || []).length > 0 && (
                      <span className="ml-1 text-[10px] text-neutral-500">
                        {(li.filterTags || []).slice(0, 2).join("/")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}