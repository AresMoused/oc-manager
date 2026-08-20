"use client";

import { useState } from "react";
import {
  fetchLexiconCatalog,
  invalidateLexiconContentCache,
  type LexiconIndex,
  type LexiconCategory,
} from "@/lib/lexicon";

type PendingRow = { id: string; label: string; listId: string; submitterName: string };

function parseItemsRaw(raw: string) {
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)[:：]\s*(.*)$/);
    return m
      ? { name: m[1]!.trim(), tags: m[2]!.trim() || m[1]! }
      : { name: line.trim(), tags: line.trim() + ", " };
  });
}

export default function GeneratorAdminPanel(props: {
  index: LexiconIndex | null;
  setIndex: (v: LexiconIndex | null | ((p: LexiconIndex | null) => LexiconIndex | null)) => void;
  enabledIds: string[];
  setEnabledIds: (v: string[]) => void;
  fixed: string;
  reload: (ids: string[], fx: string) => Promise<void>;
  pending: PendingRow[];
  setPending: (v: PendingRow[] | ((p: PendingRow[]) => PendingRow[])) => void;
  toastMsg: (m: string) => void;
}) {
  const { index, setIndex, enabledIds, setEnabledIds, fixed, reload, pending, setPending, toastMsg } = props;
  const [adminOpen, setAdminOpen] = useState(true);
  const [adminBusy, setAdminBusy] = useState(false);
  const [upLabel, setUpLabel] = useState("");
  const [upCat, setUpCat] = useState("");
  const [upRaw, setUpRaw] = useState("");
  const [editRaw, setEditRaw] = useState<{ listId: string; label: string; raw: string } | null>(null);
  const [editMeta, setEditMeta] = useState<{ listId: string; label: string; categoryId: string; categoryLabel: string } | null>(null);
  const [editCat, setEditCat] = useState<{ id: string; label: string } | null>(null);

  const applyIndex = async (next: LexiconIndex) => {
    setIndex(next);
    await reload(enabledIds, fixed);
  };

  const saveReorder = async (categories: LexiconCategory[]) => {
    setAdminBusy(true);
    try {
      const res = await fetch("/api/lexicon/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", categories }),
      });
      const j = await res.json();
      if (!res.ok) { toastMsg(j.error || "排序失败"); return; }
      if (j.index) await applyIndex(j.index);
      else setIndex((prev) => (prev ? { ...prev, categories } : prev));
      toastMsg(j.message || "已更新排序");
    } finally { setAdminBusy(false); }
  };

  const moveList = async (listId: string, dir: -1 | 1) => {
    if (!index) return;
    const categories = index.categories.map((c) => ({ ...c, lists: [...c.lists] }));
    for (const cat of categories) {
      const i = cat.lists.findIndex((l) => l.id === listId);
      if (i < 0) continue;
      const j = i + dir;
      if (j < 0 || j >= cat.lists.length) return;
      const tmp = cat.lists[i]!;
      cat.lists[i] = cat.lists[j]!;
      cat.lists[j] = tmp;
      await saveReorder(categories);
      return;
    }
  };

  const moveCategory = async (categoryId: string, dir: -1 | 1) => {
    if (!index) return;
    const categories = index.categories.map((c) => ({ ...c, lists: [...c.lists] }));
    const i = categories.findIndex((c) => c.id === categoryId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const tmp = categories[i]!;
    categories[i] = categories[j]!;
    categories[j] = tmp;
    await saveReorder(categories);
  };

  const saveCategoryName = async () => {
    if (!editCat) return;
    const label = editCat.label.trim();
    if (!label) return toastMsg("分类名称不能为空");
    setAdminBusy(true);
    try {
      const res = await fetch("/api/lexicon/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename-category", categoryId: editCat.id, label }),
      });
      const j = await res.json();
      if (!res.ok) { toastMsg(j.error || j.message || "改名失败"); return; }
      if (j.index) await applyIndex(j.index);
      else {
        setIndex((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: prev.categories.map((c) =>
              c.id === editCat.id ? { ...c, label } : c
            ),
          };
        });
      }
      toastMsg(j.message || "已更新分类名称");
      setEditCat(null);
    } finally { setAdminBusy(false); }
  };

  return (
    <div className="border border-amber-900/50 rounded-xl bg-[#111] overflow-hidden">
      <button type="button" className="w-full flex justify-between items-center px-4 py-3 text-left" onClick={() => setAdminOpen((v) => !v)}>
        <div>
          <div className="text-sm font-semibold text-amber-200">词库管理（管理员）</div>
          <div className="text-[11px] text-neutral-500">直接发布 · 排序 · 改名 · 内容 · 审核 · 删除</div>
        </div>
        <span className="text-xs text-neutral-400">{adminOpen ? "▲" : "▼"}</span>
      </button>
      {adminOpen && (
        <div className="px-4 pb-4 border-t border-amber-900/40 space-y-4 pt-3">
          <div className="border border-neutral-800 rounded-lg p-3 space-y-2">
            <div className="text-xs text-amber-200/90 font-medium">管理员直接发布（跳过审核）</div>
            <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="列表名称" value={upLabel} onChange={(e) => setUpLabel(e.target.value)} />
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
              list="lexicon-admin-category-suggestions"
              placeholder="分类名称（输入新名称即自动创建）"
              value={upCat}
              onChange={(e) => setUpCat(e.target.value)}
            />
            <datalist id="lexicon-admin-category-suggestions">
              {(index?.categories || []).map((c) => (
                <option key={c.id} value={c.label} />
              ))}
            </datalist>
            <div className="text-[10px] text-neutral-500">输入已有分类名会加入该分类；输入新名称会自动创建分类。</div>
            <div className="text-[10px] text-neutral-500 font-mono">格式：名称: tags（每行一条）例：黑色头发: black hair,</div>
            <textarea className="w-full min-h-[90px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" placeholder={"黑色头发: black hair,\n银色头发: silver hair,"} value={upRaw} onChange={(e) => setUpRaw(e.target.value)} />
            <button type="button" disabled={adminBusy} className="text-[11px] px-2.5 py-1 rounded bg-emerald-900/40 border border-emerald-800 text-emerald-200 disabled:opacity-40" onClick={async () => {
              const items = parseItemsRaw(upRaw);
              if (!upLabel.trim() || !items.length) return toastMsg("请填写名称和词条");
              const catName = upCat.trim();
              if (!catName) return toastMsg("请填写分类名称");
              const catMeta = index?.categories.find(
                (c) => c.id === catName || c.label === catName || c.label.toLowerCase() === catName.toLowerCase()
              );
              setAdminBusy(true);
              try {
                const res = await fetch("/api/lexicon/manage", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "publish-direct",
                    categoryId: catMeta?.id || catName,
                    categoryLabel: catMeta?.label || catName,
                    label: upLabel.trim(),
                    items,
                  }),
                });
                const j = await res.json();
                if (!res.ok) { toastMsg(j.error || j.message || "发布失败"); return; }
                toastMsg(j.message || "已发布");
                if (j.index) await applyIndex(j.index);
                else { const cat = await fetchLexiconCatalog(); setIndex(cat.index); }
                setUpLabel(""); setUpRaw("");
              } finally { setAdminBusy(false); }
            }}>直接发布到 CDN</button>
          </div>

          <button type="button" disabled={adminBusy} className="text-[11px] px-2.5 py-1 rounded border border-amber-800 text-amber-200 disabled:opacity-40" onClick={async () => {
            setAdminBusy(true);
            try {
              const res = await fetch("/api/lexicon/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "set-default", enabledListIds: enabledIds.filter((id) => !id.startsWith("local/")) }),
              });
              const j = await res.json();
              toastMsg(res.ok ? (j.message || "已保存默认") : (j.error || "失败"));
            } finally { setAdminBusy(false); }
          }}>把当前启动设为站点默认</button>

          <div>
            <div className="text-xs text-neutral-400 mb-1">待审核 {pending.length} 条</div>
            {pending.length === 0 ? <p className="text-[11px] text-neutral-600">暂无待审投稿</p> : pending.map((p) => (
              <div key={p.id} className="flex flex-wrap gap-2 text-xs items-center mb-1">
                <span className="text-neutral-200">{p.label} · {p.listId}</span>
                <span className="text-neutral-500">by {p.submitterName}</span>
                <button className="text-emerald-300 border border-emerald-700 px-2 rounded" onClick={async () => {
                  await fetch("/api/lexicon/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, action: "approve" }) });
                  setPending((x) => x.filter((i) => i.id !== p.id));
                  toastMsg("已通过");
                  const cat = await fetchLexiconCatalog();
                  setIndex(cat.index);
                }}>通过</button>
                <button className="text-rose-400 border border-rose-800 px-2 rounded" onClick={async () => {
                  await fetch("/api/lexicon/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, action: "reject" }) });
                  setPending((x) => x.filter((i) => i.id !== p.id));
                  toastMsg("已拒绝");
                }}>拒绝</button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-neutral-400">公共列表</div>
            <div className="text-[10px] text-neutral-600">分类可上下排序、改名；列表可在分类内排序。</div>
            {(index?.categories || []).map((cat, catIdx) => (
              <div key={cat.id} className="border border-neutral-800 rounded-lg p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" disabled={adminBusy || catIdx === 0} className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30 text-[11px]" onClick={() => void moveCategory(cat.id, -1)}>↑</button>
                  <button type="button" disabled={adminBusy || catIdx === (index?.categories.length || 0) - 1} className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30 text-[11px]" onClick={() => void moveCategory(cat.id, 1)}>↓</button>
                  {editCat?.id === cat.id ? (
                    <>
                      <input
                        className="flex-1 min-w-[8rem] bg-neutral-900 border border-amber-700 rounded px-2 py-0.5 text-xs text-neutral-100"
                        value={editCat.label}
                        autoFocus
                        onChange={(e) => setEditCat({ ...editCat, label: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); void saveCategoryName(); }
                          if (e.key === "Escape") setEditCat(null);
                        }}
                      />
                      <button type="button" disabled={adminBusy} className="px-1.5 py-0.5 rounded border border-emerald-800 text-emerald-300 text-[11px] disabled:opacity-40" onClick={() => void saveCategoryName()}>保存</button>
                      <button type="button" className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 text-[11px]" onClick={() => setEditCat(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-neutral-200 font-medium flex-1 min-w-[4rem]">{cat.label}</span>
                      <button type="button" className="px-1.5 py-0.5 rounded border border-sky-800 text-sky-300 text-[11px]" onClick={() => setEditCat({ id: cat.id, label: cat.label })}>改名</button>
                    </>
                  )}
                </div>
                {cat.lists.map((li, liIdx) => (
                  <div key={li.id} className="flex flex-wrap items-center gap-1.5 pl-2 text-[11px]">
                    <span className="text-neutral-300 min-w-[4rem]">{li.label}</span>
                    <button type="button" disabled={adminBusy || liIdx === 0} className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30" onClick={() => void moveList(li.id, -1)}>↑</button>
                    <button type="button" disabled={adminBusy || liIdx === cat.lists.length - 1} className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 disabled:opacity-30" onClick={() => void moveList(li.id, 1)}>↓</button>
                    <button type="button" className="px-1.5 py-0.5 rounded border border-sky-800 text-sky-300" onClick={() => setEditMeta({ listId: li.id, label: li.label, categoryId: cat.id, categoryLabel: cat.label })}>改名/分类</button>
                    <button type="button" disabled={adminBusy} className="px-1.5 py-0.5 rounded border border-violet-800 text-violet-300" onClick={async () => {
                      setAdminBusy(true);
                      try {
                        const res = await fetch(`/api/lexicon/list?id=${encodeURIComponent(li.id)}`);
                        if (!res.ok) { toastMsg("加载失败"); return; }
                        const j = await res.json();
                        const items = (j?.items || []) as { name: string; tags: string }[];
                        setEditRaw({ listId: li.id, label: j?.label || li.label, raw: items.map((it) => `${it.name}: ${it.tags}`).join("\n") });
                      } finally { setAdminBusy(false); }
                    }}>编辑内容</button>
                    <button type="button" disabled={adminBusy} className="px-1.5 py-0.5 rounded border border-rose-900/60 text-rose-400" onClick={async () => {
                      if (!window.confirm(`删除「${li.label}」？`)) return;
                      setAdminBusy(true);
                      try {
                        const res = await fetch("/api/lexicon/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", listId: li.id }) });
                        const j = await res.json();
                        if (!res.ok) { toastMsg(j.error || "删除失败"); return; }
                        toastMsg(j.message || "已删除");
                        setIndex((prev) => {
                          if (!prev) return prev;
                          return { ...prev, categories: prev.categories.map((c) => ({ ...c, lists: c.lists.filter((x) => x.id !== li.id) })).filter((c) => c.lists.length > 0) };
                        });
                        const next = enabledIds.filter((x) => x !== li.id);
                        setEnabledIds(next);
                        await reload(next, fixed);
                      } finally { setAdminBusy(false); }
                    }}>删除</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {editMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-2">
            <h2 className="text-white font-semibold">改名 / 改分类</h2>
            <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm" value={editMeta.label} onChange={(e) => setEditMeta({ ...editMeta, label: e.target.value })} placeholder="显示名称" />
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
              list="lexicon-admin-category-suggestions"
              value={editMeta.categoryLabel}
              onChange={(e) => setEditMeta({ ...editMeta, categoryLabel: e.target.value, categoryId: e.target.value })}
              placeholder="分类名称（输入新名称即自动创建）"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="text-neutral-400 text-sm" onClick={() => setEditMeta(null)}>取消</button>
              <button type="button" disabled={adminBusy} className="bg-purple-600 text-white text-sm px-3 py-1 rounded" onClick={async () => {
                setAdminBusy(true);
                try {
                  const res = await fetch("/api/lexicon/manage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update-meta", listId: editMeta.listId, label: editMeta.label, categoryId: editMeta.categoryId, categoryLabel: editMeta.categoryLabel }),
                  });
                  const j = await res.json();
                  if (!res.ok) { toastMsg(j.error || "更新失败"); return; }
                  if (j.index) await applyIndex(j.index);
                  else { const cat = await fetchLexiconCatalog(); setIndex(cat.index); }
                  toastMsg(j.message || "已更新");
                  setEditMeta(null);
                } finally { setAdminBusy(false); }
              }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {editRaw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-2 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold">编辑内容 · {editRaw.label}</h2>
            <p className="text-[11px] text-neutral-500">每行一条：名称: tags</p>
            <textarea className="w-full min-h-[200px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" value={editRaw.raw} onChange={(e) => setEditRaw({ ...editRaw, raw: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="text-neutral-400 text-sm" onClick={() => setEditRaw(null)}>取消</button>
              <button type="button" disabled={adminBusy} className="bg-purple-600 text-white text-sm px-3 py-1 rounded" onClick={async () => {
                const items = parseItemsRaw(editRaw.raw);
                if (!items.length) return toastMsg("内容不能为空");
                setAdminBusy(true);
                try {
                  const res = await fetch("/api/lexicon/manage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update-content", listId: editRaw.listId, items, label: editRaw.label }),
                  });
                  const j = await res.json();
                  if (!res.ok) { toastMsg(j.error || "保存失败"); return; }
                  toastMsg(j.message || "已更新内容");
                  invalidateLexiconContentCache(editRaw.listId);
                  setEditRaw(null);
                  await reload(enabledIds, fixed);
                } finally { setAdminBusy(false); }
              }}>保存内容</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
