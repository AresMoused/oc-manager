"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  JOINTS,
  PAGE_H,
  PAGE_W,
  bubbleHasTail,
  figureBounds,
  jointToPage,
  pageToJoint,
  renderStoryboardSvg,
  type JointName,
  type Storyboard,
} from "@/lib/storyboard";

export type Selection =
  | { kind: "frame"; id: string }
  | { kind: "bubble"; id: string }
  | { kind: "figure"; id: string }
  | null;

type DragMode = "move" | "resize" | "tail" | `joint:${JointName}`;

interface Drag {
  mode: DragMode;
  sel: NonNullable<Selection>;
  start: [number, number];
  orig: Storyboard;
  /** Elements carried along when a frame is moved */
  carry: { bubbles: string[]; figures: string[] };
}

const HANDLE = 7;

/**
 * Interactive page: the static SVG (same string used for export) is drawn
 * underneath, and a transparent overlay SVG in page coordinates handles
 * selection, drag-move, resize, speech-tail and stick-figure joint editing.
 */
export default function StoryboardCanvas({
  board,
  selection,
  onSelect,
  onChange,
}: {
  board: Storyboard;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onChange: (next: Storyboard) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const toPage = (e: { clientX: number; clientY: number }): [number, number] => {
    const el = svgRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * PAGE_H];
  };

  const begin = (e: RPointerEvent, sel: NonNullable<Selection>, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    onSelect(sel);
    const carry = { bubbles: [] as string[], figures: [] as string[] };
    if (sel.kind === "frame" && mode === "move") {
      const fr = board.frames.find((f) => f.id === sel.id);
      if (fr && fr.kind !== "title") {
        const inside = (x: number, y: number) => x >= fr.x && x <= fr.x + fr.w && y >= fr.y && y <= fr.y + fr.h;
        carry.bubbles = board.bubbles.filter((b) => inside(b.x + b.w / 2, b.y + b.h / 2)).map((b) => b.id);
        carry.figures = board.figures.filter((f) => inside(f.x, f.y - 4)).map((f) => f.id);
      }
    }
    setDrag({ mode, sel, start: toPage(e), orig: board, carry });
  };

  const move = (e: RPointerEvent) => {
    if (!drag) return;
    const [px, py] = toPage(e);
    const dx = px - drag.start[0];
    const dy = py - drag.start[1];
    const o = drag.orig;
    const { sel, mode } = drag;
    const next: Storyboard = { ...o };
    if (sel.kind === "frame") {
      next.frames = o.frames.map((f) => {
        if (f.id !== sel.id) return f;
        return mode === "resize"
          ? { ...f, w: Math.max(20, f.w + dx), h: Math.max(20, f.h + dy) }
          : { ...f, x: f.x + dx, y: f.y + dy };
      });
      if (mode === "move") {
        next.bubbles = o.bubbles.map((b) =>
          drag.carry.bubbles.includes(b.id) ? { ...b, x: b.x + dx, y: b.y + dy, tailX: b.tailX + dx, tailY: b.tailY + dy } : b
        );
        next.figures = o.figures.map((f) => (drag.carry.figures.includes(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f));
      }
    } else if (sel.kind === "bubble") {
      next.bubbles = o.bubbles.map((b) => {
        if (b.id !== sel.id) return b;
        if (mode === "resize") return { ...b, w: Math.max(16, b.w + dx), h: Math.max(16, b.h + dy) };
        if (mode === "tail") return { ...b, tailX: b.tailX + dx, tailY: b.tailY + dy };
        return { ...b, x: b.x + dx, y: b.y + dy, tailX: b.tailX + dx, tailY: b.tailY + dy };
      });
    } else {
      next.figures = o.figures.map((f) => {
        if (f.id !== sel.id) return f;
        if (mode === "resize") {
          const bb = figureBounds(f);
          const k = Math.max(0.1, (bb.h - dy) / bb.h);
          return { ...f, size: Math.max(10, f.size * k) };
        }
        if (mode.startsWith("joint:")) {
          const j = mode.slice(6) as JointName;
          return { ...f, joints: { ...f.joints, [j]: pageToJoint(f, px, py) } };
        }
        return { ...f, x: f.x + dx, y: f.y + dy };
      });
    }
    onChange(next);
  };

  const end = () => setDrag(null);

  const isSel = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const outline = (x: number, y: number, w: number, h: number) => (
    <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill="none" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="5 3" pointerEvents="none" />
  );
  const handle = (x: number, y: number, onDown: (e: RPointerEvent) => void, color = "#a855f7", round = false, title?: string) =>
    round ? (
      <circle cx={x} cy={y} r={HANDLE * 0.75} fill="#fff" stroke={color} strokeWidth={2} style={{ cursor: "grab" }} onPointerDown={onDown}>
        {title && <title>{title}</title>}
      </circle>
    ) : (
      <rect x={x - HANDLE / 2} y={y - HANDLE / 2} width={HANDLE} height={HANDLE} fill="#fff" stroke={color} strokeWidth={2} style={{ cursor: "nwse-resize" }} onPointerDown={onDown}>
        {title && <title>{title}</title>}
      </rect>
    );

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
      <div
        className="absolute inset-0 bg-white [&>svg]:w-full [&>svg]:h-full pointer-events-none"
        dangerouslySetInnerHTML={{ __html: renderStoryboardSvg(board) }}
      />
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full touch-none"
        viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={() => onSelect(null)}
      >
        {board.frames.filter((f) => !f.hidden && !f.locked).map((f) => (
          <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} fill="transparent" stroke="transparent" strokeWidth={8}
            style={{ cursor: "move" }} onPointerDown={(e) => begin(e, { kind: "frame", id: f.id }, "move")} />
        ))}
        {board.figures.filter((f) => !f.hidden && !f.locked).map((f) => {
          const b = figureBounds(f);
          return (
            <rect key={f.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent"
              style={{ cursor: "move" }} onPointerDown={(e) => begin(e, { kind: "figure", id: f.id }, "move")} />
          );
        })}
        {board.bubbles.filter((b) => !b.hidden && !b.locked).map((b) => (
          <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent"
            style={{ cursor: "move" }} onPointerDown={(e) => begin(e, { kind: "bubble", id: b.id }, "move")} />
        ))}

        {/* selection chrome */}
        {board.frames.filter((f) => isSel("frame", f.id) && !f.hidden).map((f) => (
          <g key={f.id}>
            {outline(f.x, f.y, f.w, f.h)}
            {!f.locked && handle(f.x + f.w, f.y + f.h, (e) => begin(e, { kind: "frame", id: f.id }, "resize"), "#a855f7", false, "调整大小")}
          </g>
        ))}
        {board.bubbles.filter((b) => isSel("bubble", b.id) && !b.hidden).map((b) => (
          <g key={b.id}>
            {outline(b.x, b.y, b.w, b.h)}
            {!b.locked && handle(b.x + b.w, b.y + b.h, (e) => begin(e, { kind: "bubble", id: b.id }, "resize"), "#a855f7", false, "调整大小")}
            {!b.locked && bubbleHasTail(b.style) &&
              handle(b.tailX, b.tailY, (e) => begin(e, { kind: "bubble", id: b.id }, "tail"), "#f59e0b", true, "拖动尾巴")}
          </g>
        ))}
        {board.figures.filter((f) => isSel("figure", f.id) && !f.hidden).map((f) => {
          const bb = figureBounds(f);
          const jointsEditable = !f.locked && (f.style === "stick" || f.style === "box");
          return (
            <g key={f.id}>
              {outline(bb.x, bb.y, bb.w, bb.h)}
              {!f.locked && handle(bb.x + bb.w, bb.y, (e) => begin(e, { kind: "figure", id: f.id }, "resize"), "#a855f7", false, "缩放")}
              {jointsEditable &&
                JOINTS.map((j) => {
                  const [x, y] = jointToPage(f, j);
                  return (
                    <g key={j}>
                      {handle(x, y, (e) => begin(e, { kind: "figure", id: f.id }, `joint:${j}`), "#22c55e", true, j)}
                    </g>
                  );
                })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
