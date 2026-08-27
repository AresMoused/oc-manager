"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BuilderData } from "@/lib/promptBuilder";
import {
  buildEnabledBuilderData,
  fetchLexiconCatalog,
  loadEnabledMap,
  loadFilterTags,
  loadFixed,
  loadLocalLists,
  resolveEnabledIds,
  saveEnabledMap,
  saveFilterTags,
  setListEnabled,
  type LocalLexiconList,
  type LexiconIndex,
} from "@/lib/lexicon";
import { LexiconCatalogBody, LexiconFilterBar, type CatalogCat } from "@/components/LexiconCatalog";

export default function LexiconEnableModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: (builder: BuilderData) => void;
}) {
  const [index, setIndex] = useState<LexiconIndex | null>(null);
  const [localLists, setLocalLists] = useState<LocalLexiconList[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { index: idx, defaultEnabled } = await fetchLexiconCatalog();
      setIndex(idx);
      const locals = loadLocalLists();
      setLocalLists(locals);
      const allIds = [
        ...idx.categories.flatMap((c) => c.lists.map((l) => l.id)),
        ...locals.map((l) => l.id),
      ];
      setEnabledIds(resolveEnabledIds(allIds, defaultEnabled));
      const open: Record<string, boolean> = {};
      idx.categories.forEach((c) => {
        open[c.id] = true;
      });
      setOpenCats(open);
      setFilter(loadFilterTags());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const cats: CatalogCat[] = useMemo(() => {
    const list = index
      ? index.categories.map((c) => ({ ...c, lists: [...c.lists] }))
      : [];
    for (const l of localLists) {
      let c = list.find((x) => x.id === l.categoryId);
      if (!c) {
        c = { id: l.categoryId, label: l.categoryLabel, lists: [] };
        list.push(c);
      }
      if (!c.lists.some((x) => x.id === l.id)) {
        c.lists.push({
          id: l.id,
          label: l.label + "（本地）",
          path: "",
          filterTags: l.filterTags,
        });
      }
    }
    return list;
  }, [index, localLists]);

  const persistBuilder = async (ids: string[]) => {
    const data = await buildEnabledBuilderData(ids, loadFixed());
    try {
      localStorage.setItem("oc-lexicon-runtime-builder", JSON.stringify(data));
    } catch { /* ignore */ }
    onApplied(data);
  };

  const toggleList = async (id: string) => {
    const on = !enabledIds.includes(id);
    setListEnabled(id, on);
    const next = on ? [...enabledIds, id] : enabledIds.filter((x) => x !== id);
    setEnabledIds(next);
    const map = loadEnabledMap() || {};
    map[id] = on;
    saveEnabledMap(map);
    setBusy(true);
    try {
      await persistBuilder(next);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-white font-semibold">词库开关</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              勾选后参与随机。已启动 {enabledIds.length} 个
              {busy ? " · 同步中…" : ""}
            </p>
          </div>
          <button type="button" className="text-neutral-400 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>
        <LexiconFilterBar
          cats={cats}
          active={filter}
          onChange={(next) => {
            setFilter(next);
            saveFilterTags(next);
          }}
        />
        {loading ? (
          <p className="text-xs text-neutral-500">加载中…</p>
        ) : (
          <LexiconCatalogBody
            cats={cats}
            enabledIds={enabledIds}
            openCats={openCats}
            onToggleCat={(id) =>
              setOpenCats((p) => ({ ...p, [id]: p[id] === false }))
            }
            onToggleList={(id) => void toggleList(id)}
            activeFilter={filter}
          />
        )}
        <div className="flex justify-between items-center pt-1 border-t border-neutral-800">
          <Link href="/generator" className="text-[11px] text-sky-400 hover:underline">
            打开外观生成器（锁定选项 / 编辑列表）
          </Link>
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