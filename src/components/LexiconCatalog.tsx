"use client";

import { useMemo } from "react";
import {
  collectFilterTags,
  listMatchesFilter,
  mergeWeightOf,
  type LexiconListMeta,
  type LexiconMergeState,
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
  merge,
  onToggleMerge,
  onCycleWeight,
}: {
  cats: CatalogCat[];
  enabledIds: string[];
  openCats: Record<string, boolean>;
  onToggleCat: (id: string) => void;
  onToggleList: (id: string) => void;
  activeFilter: string[];
  merge?: LexiconMergeState;
  onToggleMerge?: (categoryId: string) => void;
  onCycleWeight?: (categoryId: string, listId: string) => void;
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
      {visible.map((cat) => {
        const enabledInCat = cat.lists.filter((l) => enabledIds.includes(l.id)).length;
        const mergeOn = !!merge?.[cat.id]?.on && enabledInCat >= 2;
        const canMerge = enabledInCat >= 2 && !!onToggleMerge;
        return (
        <div key={cat.id}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <button
              type="button"
              className="text-xs text-neutral-300"
              onClick={() => onToggleCat(cat.id)}
            >
              {openCats[cat.id] !== false ? "▼" : "▶"} {cat.label}
              <span className="text-neutral-600 ml-1">
                {enabledInCat}/{cat.lists.length}
              </span>
            </button>
            {canMerge && (
              <button
                type="button"
                title={
                  mergeOn
                    ? "已合并：随机时只从本分类开启的词库里抽一本，权重跟整本走"
                    : "开启后本分类每次只随机一本词库"
                }
                onClick={() => onToggleMerge(cat.id)}
                className={`px-2 py-0.5 text-[10px] rounded-full border ${
                  mergeOn
                    ? "border-amber-600 text-amber-200 bg-amber-950/40"
                    : "border-neutral-700 text-neutral-500 hover:border-neutral-500"
                }`}
              >
                {mergeOn ? `合并随机 · ${enabledInCat}选1` : "合并随机"}
              </button>
            )}
          </div>
          {openCats[cat.id] !== false && (
            <div className="flex flex-wrap gap-2 pl-3">
              {cat.lists.map((li) => {
                const on = enabledIds.includes(li.id);
                const w = mergeWeightOf(merge || {}, cat.id, li.id);
                return (
                  <div key={li.id} className="inline-flex items-stretch">
                    <button
                      type="button"
                      onClick={() => onToggleList(li.id)}
                      title={(li.filterTags || []).join(" · ") || undefined}
                      className={`px-2.5 py-1 text-xs rounded-l-lg border ${
                        on
                          ? "border-emerald-700 text-emerald-200 bg-emerald-950/30"
                          : "border-neutral-800 text-neutral-500"
                      } ${on && mergeOn ? "rounded-r-none border-r-0" : "rounded-r-lg"}`}
                    >
                      {on ? "✓ " : "○ "}
                      {li.label}
                      {(li.filterTags || []).length > 0 && (
                        <span className="ml-1 text-[10px] text-neutral-500">
                          {(li.filterTags || []).slice(0, 2).join("/")}
                        </span>
                      )}
                    </button>
                    {on && mergeOn && onCycleWeight && (
                      <button
                        type="button"
                        title={`词库权重 ×${w}（点按 1–5 循环，按整本抽中，本内词条均等）`}
                        onClick={() => onCycleWeight(cat.id, li.id)}
                        className="px-1.5 py-1 text-[10px] rounded-r-lg border border-amber-700 text-amber-200 bg-amber-950/30 tabular-nums"
                      >
                        ×{w}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}