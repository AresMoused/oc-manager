"use client";

import { useState } from "react";
import type { Selection } from "@/components/StoryboardCanvas";
import {
  LAYER_KEY,
  layerGroups,
  layerLabel,
  moveInGroup,
  moveLayer,
  setMemberGroup,
  type Bubble,
  type Figure,
  type Frame,
  type LayerKind,
  type LayerProps,
  type MemberKind,
  type Storyboard,
} from "@/lib/storyboard";

const smallCls =
  "bg-[#0a0a0a] border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-purple-500";
const iconBtn = "px-0.5 hover:text-white";

type DragItem = { kind: LayerKind; id: string };

/**
 * Layers grouped by panel (分格). Each panel is a group holding the text boxes
 * and figures that belong to it (explicit `frameId`); elements outside every
 * panel live in 未分格. Groups collapse, hide/lock as a whole, and reorder;
 * members reorder within their group and can be moved to another group by the
 * row menu or by dragging the row onto a group header.
 */
export default function StoryboardLayers({
  board,
  selection,
  onSelect,
  onChange,
  defaultCollapsed = [],
}: {
  board: Storyboard;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onChange: (next: Storyboard) => void;
  defaultCollapsed?: string[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(defaultCollapsed));
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const groups = layerGroups(board);
  const targets = board.frames.filter((f) => f.kind !== "title");
  /** Unnamed panels are numbered in page order so headers and the move-to menu match */
  const frameTitle = (f: Frame) => {
    if (f.name || f.kind !== "panel") return layerLabel("frame", f);
    return `分格 ${board.frames.filter((x) => x.kind === "panel").indexOf(f) + 1}`;
  };

  const patch = (kind: LayerKind, id: string, p: LayerProps) => {
    const key = LAYER_KEY[kind];
    onChange({ ...board, [key]: (board[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } as Storyboard);
  };
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const dropOnGroup = (groupId: string, frame?: Frame) => {
    if (!drag) return;
    if (drag.kind === "frame") {
      // reorder panels: drop a panel header on another panel header
      if (frame && drag.id !== frame.id) {
        const list = [...board.frames];
        const from = list.findIndex((f) => f.id === drag.id);
        const [it] = list.splice(from, 1);
        list.splice(list.findIndex((f) => f.id === frame.id) + 1, 0, it);
        onChange({ ...board, frames: list });
      }
    } else if (!frame || frame.kind !== "title") {
      onChange(setMemberGroup(board, drag.kind, drag.id, groupId));
    }
    setDrag(null);
  };

  const nameCell = (kind: LayerKind, el: Frame | Bubble | Figure) =>
    renaming === el.id ? (
      <input autoFocus className={smallCls + " flex-1 min-w-0"} defaultValue={el.name ?? ""}
        placeholder={layerLabel(kind, { ...el, name: undefined })}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { patch(kind, el.id, { name: e.target.value.trim() || undefined }); setRenaming(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
    ) : (
      <span className="flex-1 truncate" onDoubleClick={() => setRenaming(el.id)}>{layerLabel(kind, el)}</span>
    );

  const flagBtns = (kind: LayerKind, el: Frame | Bubble | Figure) => (
    <>
      <button title={el.hidden ? "显示" : "隐藏"} className={iconBtn} onClick={(e) => { e.stopPropagation(); patch(kind, el.id, { hidden: !el.hidden }); }}>{el.hidden ? "◌" : "👁"}</button>
      <button title={el.locked ? "解锁" : "锁定"} className={iconBtn} onClick={(e) => { e.stopPropagation(); patch(kind, el.id, { locked: !el.locked }); }}>{el.locked ? "🔒" : "🔓"}</button>
    </>
  );

  return (
    <div className="space-y-1.5 text-xs text-neutral-400">
      <div className="text-white text-sm">图层 Layers</div>
      <p className="text-neutral-500 text-[11px]">
        按分格分组：组内为属于该分格的对话框与人物。组的 👁/🔒 作用于整组；拖动行到其他组标题可移组，拖动分格标题可调整分格顺序，双击重命名。
      </p>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        const fr = g.frame;
        const groupSel = !!fr && selection?.kind === "frame" && selection.id === fr.id;
        const count = g.bubbles.length + g.figures.length;
        const canHold = !fr || fr.kind !== "title";
        return (
          <div key={g.id || "ungrouped"} data-group={g.id || "ungrouped"}
            className={`rounded-lg border ${fr ? "border-neutral-800" : "border-dashed border-neutral-700"} ${fr?.hidden ? "opacity-50" : ""}`}>
            <div
              draggable={!!fr}
              onDragStart={() => fr && setDrag({ kind: "frame", id: fr.id })}
              onDragOver={(e) => { if (drag && (drag.kind === "frame" ? !!fr : canHold)) e.preventDefault(); }}
              onDrop={() => dropOnGroup(g.id, fr)}
              onClick={() => fr && onSelect({ kind: "frame", id: fr.id })}
              className={`flex items-center gap-1 px-1.5 py-1 rounded-t-lg cursor-pointer ${groupSel ? "bg-purple-900/50 text-white" : "bg-neutral-900/60 hover:bg-neutral-800/70"}`}
            >
              <button className={iconBtn} title={isCollapsed ? "展开" : "折叠"} onClick={(e) => { e.stopPropagation(); toggle(g.id); }}>{isCollapsed ? "▸" : "▾"}</button>
              {fr ? (renaming === fr.id ? nameCell("frame", fr) : <span className="flex-1 truncate" onDoubleClick={() => setRenaming(fr.id)}>{frameTitle(fr)}</span>) : <span className="flex-1 text-neutral-300">未分格</span>}
              <span className="text-neutral-600">{count}</span>
              {fr && (
                <>
                  <button title="分格上移（更靠前）" className={iconBtn} onClick={(e) => { e.stopPropagation(); onChange(moveLayer(board, "frame", fr.id, 1)); }}>↑</button>
                  <button title="分格下移（更靠后）" className={iconBtn} onClick={(e) => { e.stopPropagation(); onChange(moveLayer(board, "frame", fr.id, -1)); }}>↓</button>
                  {flagBtns("frame", fr)}
                </>
              )}
            </div>
            {!isCollapsed && (
              <div className="py-0.5">
                {count === 0 && <div className="pl-6 py-0.5 text-neutral-600">{canHold ? "（空）" : "（标题框不含成员）"}</div>}
                {([["bubble", g.bubbles], ["figure", g.figures]] as [MemberKind, (Bubble | Figure)[]][]).map(([kind, list]) =>
                  list.map((el) => {
                    const sel = selection?.kind === kind && selection.id === el.id;
                    return (
                      <div key={el.id} data-layer={el.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDrag({ kind, id: el.id }); }}
                        onDragOver={(e) => { if (drag && drag.kind !== "frame") e.preventDefault(); }}
                        onDrop={(e) => { e.stopPropagation(); dropOnGroup(g.id, fr); }}
                        onClick={() => onSelect({ kind, id: el.id } as Selection)}
                        className={`flex items-center gap-1 pl-5 pr-1.5 py-0.5 cursor-pointer ${sel ? "bg-purple-900/40 text-white" : "hover:bg-neutral-800/60"} ${el.hidden ? "opacity-50" : ""}`}
                      >
                        <span className="text-neutral-600" title={kind === "bubble" ? "对话框" : "人物"}>{kind === "bubble" ? "💬" : "🧍"}</span>
                        {nameCell(kind, el)}
                        <select title="移到分组" className="bg-transparent text-neutral-500 hover:text-white max-w-[4.5rem] text-[11px]"
                          value={el.frameId ?? ""} onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onChange(setMemberGroup(board, kind, el.id, e.target.value))}>
                          <option value="">未分格</option>
                          {targets.map((t) => <option key={t.id} value={t.id}>{frameTitle(t)}</option>)}
                        </select>
                        <button title="组内上移" className={iconBtn} onClick={(e) => { e.stopPropagation(); onChange(moveInGroup(board, kind, el.id, 1)); }}>↑</button>
                        <button title="组内下移" className={iconBtn} onClick={(e) => { e.stopPropagation(); onChange(moveInGroup(board, kind, el.id, -1)); }}>↓</button>
                        {flagBtns(kind, el)}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
