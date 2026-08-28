"use client";

import { useState } from "react";
import {
  deleteLocalList,
  loadLocalLists,
  upsertLocalList,
  type LocalLexiconList,
} from "@/lib/lexicon";

function parseItemsRaw(raw: string) {
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)[:：]\s*(.*)$/);
    return m
      ? { name: m[1]!.trim(), tags: m[2]!.trim() || m[1]! }
      : { name: line.trim(), tags: line.trim() + ", " };
  });
}

export default function LexiconLocalPanel({
  lists,
  setLists,
  categories,
  onDeleted,
  onChanged,
  toastMsg,
}: {
  lists: LocalLexiconList[];
  setLists: (v: LocalLexiconList[]) => void;
  categories: { id: string; label: string }[];
  onDeleted: (id: string) => void;
  onChanged?: () => void;
  toastMsg: (m: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [edit, setEdit] = useState<{
    id: string;
    label: string;
    categoryId: string;
    raw: string;
  } | null>(null);

  const refresh = () => setLists(loadLocalLists());

  return (
    <div className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex justify-between items-center px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <div className="text-sm font-semibold text-neutral-200">本地词库缓存</div>
          <div className="text-[11px] text-neutral-500">
            仅保存在本机浏览器 · {lists.length} 个列表
          </div>
        </div>
        <span className="text-xs text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-2">
          {lists.length === 0 ? (
            <p className="text-xs text-neutral-500">
              还没有本地列表。点上方「上传列表」会先存到这里，可随时改或删。
            </p>
          ) : (
            lists.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-1.5 text-[11px] border border-neutral-800 rounded-lg px-2 py-1.5"
              >
                <span className="text-neutral-200 font-medium">{l.label}</span>
                <span className="text-neutral-500">{l.categoryLabel}</span>
                <span className="text-neutral-600">{l.items.length} 条</span>
                <span className="text-neutral-600 ml-auto">
                  {l.createdAt ? l.createdAt.slice(0, 10) : ""}
                </span>
                <button
                  type="button"
                  className="px-1.5 py-0.5 rounded border border-sky-800 text-sky-300"
                  onClick={() =>
                    setEdit({
                      id: l.id,
                      label: l.label,
                      categoryId: l.categoryId,
                      raw: l.items.map((it) => `${it.name}: ${it.tags}`).join("\n"),
                    })
                  }
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="px-1.5 py-0.5 rounded border border-rose-900/60 text-rose-400"
                  onClick={() => {
                    if (!window.confirm(`删除本地列表「${l.label}」？无法恢复。`)) return;
                    deleteLocalList(l.id);
                    refresh();
                    onDeleted(l.id);
                    toastMsg("已从本机删除");
                  }}
                >
                  删除
                </button>
              </div>
            ))
          )}
          {lists.length > 0 && (
            <button
              type="button"
              className="text-[11px] text-rose-400/80"
              onClick={() => {
                if (!window.confirm(`清空全部 ${lists.length} 个本地列表？`)) return;
                const ids = lists.map((l) => l.id);
                for (const id of ids) deleteLocalList(id);
                refresh();
                ids.forEach(onDeleted);
                toastMsg("已清空本地词库");
              }}
            >
              清空全部本地列表
            </button>
          )}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-2 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold">编辑本地列表</h2>
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm"
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
              placeholder="列表名称"
            />
            <select
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-200"
              value={edit.categoryId}
              onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
              {!categories.some((c) => c.id === "user") && (
                <option value="user">用户投稿</option>
              )}
            </select>
            <textarea
              className="w-full min-h-[160px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
              value={edit.raw}
              onChange={(e) => setEdit({ ...edit, raw: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="text-neutral-400 text-sm" onClick={() => setEdit(null)}>取消</button>
              <button
                type="button"
                className="bg-purple-600 text-white text-sm px-3 py-1.5 rounded"
                onClick={() => {
                  const items = parseItemsRaw(edit.raw);
                  if (!edit.label.trim() || !items.length) return toastMsg("名称和词条不能为空");
                  const prev = lists.find((x) => x.id === edit.id);
                  if (!prev) return;
                  const cat = categories.find((c) => c.id === edit.categoryId);
                  upsertLocalList({
                    ...prev,
                    label: edit.label.trim(),
                    categoryId: edit.categoryId,
                    categoryLabel: cat?.label || (edit.categoryId === "user" ? "用户投稿" : edit.categoryId),
                    items,
                  });
                  refresh();
                  setEdit(null);
                  onChanged?.();
                  toastMsg("已保存到本机");
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}