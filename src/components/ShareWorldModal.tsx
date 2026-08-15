"use client";

import { useEffect, useState } from "react";

export interface ShareUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}

export interface ShareState {
  id: string;
  permission: "readonly" | "editors";
  editorIds: string[];
}

interface Props {
  open: boolean;
  worldId: string;
  worldName: string;
  worldColor: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ShareWorldModal({
  open,
  worldId,
  worldName,
  worldColor,
  onClose,
  onChanged,
}: Props) {
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ShareState | null>(null);
  const [permission, setPermission] = useState<"readonly" | "editors">("readonly");
  const [editorIds, setEditorIds] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMsg("");
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/users").then((r) => (r.ok ? r.json() : { users: [] })),
      fetch("/api/shares").then((r) => (r.ok ? r.json() : { shares: [] })),
    ])
      .then(([me, usersRes, sharesRes]) => {
        const uid = me?.user?.id || "";
        const list = (usersRes.users || []) as ShareUser[];
        setUsers(list.filter((u) => u.id !== uid));
        const mine = (sharesRes.shares || []).find(
          (s: { ownerId: string; worldId: string }) =>
            s.ownerId === uid && s.worldId === worldId
        );
        if (mine) {
          setExisting({
            id: mine.id,
            permission: mine.permission,
            editorIds: mine.editorIds || [],
          });
          setPermission(mine.permission === "editors" ? "editors" : "readonly");
          setEditorIds(mine.editorIds || []);
        } else {
          setExisting(null);
          setPermission("readonly");
          setEditorIds([]);
        }
      })
      .finally(() => setLoading(false));
  }, [open, worldId]);

  if (!open) return null;

  const toggleEditor = (id: string) => {
    setEditorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          permission,
          editorIds: permission === "editors" ? editorIds : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `失败 ${res.status}`);
      }
      const data = await res.json();
      setExisting({
        id: data.share.id,
        permission: data.share.permission,
        editorIds: data.share.editorIds || [],
      });
      setMsg(existing ? "已更新分享设置" : "已分享到分享区");
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "分享失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUnshare = async () => {
    if (!existing) return;
    if (!confirm(`撤销「${worldName}」的分享？`)) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/shares/${existing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("撤销失败");
      setExisting(null);
      setMsg("已撤销分享");
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "撤销失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">分享世界</h2>
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: worldColor }}
              />
              {worldName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-sm"
          >
            关闭
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500 py-6 text-center">加载中…</p>
        ) : (
          <>
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">权限</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPermission("readonly")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    permission === "readonly"
                      ? "border-purple-500 text-purple-200 bg-purple-950/30"
                      : "border-neutral-700 text-neutral-400"
                  }`}
                >
                  唯读
                </button>
                <button
                  type="button"
                  onClick={() => setPermission("editors")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    permission === "editors"
                      ? "border-purple-500 text-purple-200 bg-purple-950/30"
                      : "border-neutral-700 text-neutral-400"
                  }`}
                >
                  指定用户可修改
                </button>
              </div>
              <p className="text-[11px] text-neutral-600 mt-1.5">
                {permission === "readonly"
                  ? "所有登录用户可在分享区查看，但不能修改。"
                  : "勾选的用户可修改该世界下的角色数据；其他人唯读。"}
              </p>
            </div>

            {permission === "editors" && (
              <div>
                <label className="text-xs text-neutral-500 block mb-1.5">
                  可修改的用户（已登录过）
                </label>
                {users.length === 0 ? (
                  <p className="text-xs text-neutral-600 py-3 text-center border border-dashed border-neutral-800 rounded-lg">
                    暂无其他用户登录过
                  </p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-neutral-800 p-2">
                    {users.map((u) => {
                      const checked = editorIds.includes(u.id);
                      const name = u.globalName || u.username;
                      return (
                        <li key={u.id}>
                          <label
                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                              checked
                                ? "bg-purple-950/40 border border-purple-800/50"
                                : "hover:bg-neutral-900 border border-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditor(u.id)}
                              className="rounded border-neutral-600"
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-neutral-700"
                            />
                            <span className="text-sm text-neutral-200 truncate">
                              {name}
                            </span>
                            <span className="text-[10px] text-neutral-600 ml-auto shrink-0">
                              @{u.username}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {msg && (
              <p className="text-xs text-center text-neutral-400">{msg}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {existing && (
                <button
                  type="button"
                  onClick={handleUnshare}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg border border-rose-900/50 text-rose-400 hover:bg-rose-950/30 disabled:opacity-40"
                >
                  撤销分享
                </button>
              )}
              <button
                type="button"
                onClick={handleShare}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
              >
                {saving
                  ? "保存中…"
                  : existing
                    ? "更新分享设置"
                    : "分享到分享区"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
