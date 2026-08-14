"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Character, Relationship } from "@/lib/types";

export const REL_TYPE_COLORS: Record<Relationship["type"], string> = {
  friend: "#34d399",
  family: "#38bdf8",
  ally: "#60a5fa",
  enemy: "#f87171",
  rival: "#fbbf24",
  lover: "#f472b6",
  mentor: "#a78bfa",
  other: "#a3a3a3",
};

export const REL_TYPE_LABELS: Record<Relationship["type"], string> = {
  friend: "Friend 友",
  family: "Family 亲",
  ally: "Ally 盟",
  enemy: "Enemy 敌",
  rival: "Rival 竞",
  lover: "Lover 恋",
  mentor: "Mentor 师",
  other: "Other 其他",
};

interface Edge {
  from: string;
  to: string;
  type: Relationship["type"];
  strength: number;
  note: string;
  fromName: string;
  toName: string;
}

interface Props {
  characters: Character[];
  focusId?: string;
  height?: number;
  className?: string;
  storageKey?: string;
}

export default function RelationshipGraph({
  characters,
  focusId,
  height = 520,
  className = "",
  storageKey = "oc-rel-graph-pos",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [hoverEdge, setHoverEdge] = useState<Edge | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  useEffect(() => {
    if (characters.length === 0) return;
    let saved: Record<string, { x: number; y: number }> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch { /* ignore */ }

    const centerX = size.w / 2;
    const centerY = size.h / 2;
    const radius = Math.min(size.w, size.h) * 0.32;
    const next: Record<string, { x: number; y: number }> = {};
    characters.forEach((c, i) => {
      if (saved[c.id]) {
        next[c.id] = {
          x: Math.min(size.w - 40, Math.max(40, saved[c.id].x)),
          y: Math.min(size.h - 40, Math.max(40, saved[c.id].y)),
        };
      } else if (positions[c.id]) {
        next[c.id] = positions[c.id];
      } else {
        const angle = (i / Math.max(characters.length, 1)) * Math.PI * 2 - Math.PI / 2;
        next[c.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      }
    });
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters.map((c) => c.id).join(","), size.w, size.h, storageKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: Math.max(height, rect.height) });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setSize({ w: rect.width, h: Math.max(height, rect.height) });
    return () => ro.disconnect();
  }, [height]);

  const persistPos = useCallback(
    (pos: Record<string, { x: number; y: number }>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(pos));
      } catch { /* ignore */ }
    },
    [storageKey]
  );

  const edges = useMemo(() => {
    const list: Edge[] = [];
    const seen = new Set<string>();
    const byId = new Map(characters.map((c) => [c.id, c]));
    for (const c of characters) {
      for (const r of c.relationships || []) {
        if (!byId.has(r.targetId)) continue;
        const key = [c.id, r.targetId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const other = byId.get(r.targetId)!;
        list.push({
          from: c.id,
          to: r.targetId,
          type: r.type,
          strength: r.strength,
          note: r.note || "",
          fromName: c.name,
          toName: other.name,
        });
      }
    }
    return list;
  }, [characters]);

  const onPointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[id];
    if (!pos) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y,
    };
    setDragging(id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragging) {
      const x = Math.min(size.w - 30, Math.max(30, mx - dragOffset.current.x));
      const y = Math.min(size.h - 30, Math.max(30, my - dragOffset.current.y));
      setPositions((prev) => ({
        ...prev,
        [dragging]: { x, y },
      }));
    }
  };

  const onPointerUp = () => {
    if (dragging) {
      setPositions((prev) => {
        persistPos(prev);
        return prev;
      });
    }
    setDragging(null);
  };

  const showEdgeTip = (edge: Edge, e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverEdge(edge);
    const lines = [
      `${edge.fromName}  ↔  ${edge.toName}`,
      REL_TYPE_LABELS[edge.type],
      `强度 ${edge.strength}/5`,
    ];
    if (edge.note) lines.push(edge.note);
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top + 12,
      lines,
    });
  };

  const showNodeTip = (c: Character, e: React.PointerEvent) => {
    if (dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverNode(c.id);
    const rels = (c.relationships || [])
      .map((r) => {
        const t = characters.find((x) => x.id === r.targetId);
        return t ? `${REL_TYPE_LABELS[r.type]} · ${t.name}` : null;
      })
      .filter(Boolean) as string[];
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top + 12,
      lines: [c.name, ...rels.slice(0, 6)],
    });
  };

  const clearTip = () => {
    setHoverEdge(null);
    setHoverNode(null);
    setTooltip(null);
  };

  if (characters.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-xl ${className}`}
        style={{ height }}
      >
        暂无角色
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-[#0c0c0c] border border-neutral-800 rounded-xl overflow-hidden ${className}`}
      style={{ height }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        onPointerUp();
        clearTip();
      }}
    >
      <svg width="100%" height="100%" className="block select-none">
        {edges.map((e, i) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          const active =
            hoverEdge === e ||
            hoverNode === e.from ||
            hoverNode === e.to ||
            (focusId && (e.from === focusId || e.to === focusId));
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={REL_TYPE_COLORS[e.type]}
                strokeWidth={active ? 2 + e.strength : 1 + e.strength * 0.7}
                strokeOpacity={active ? 0.95 : 0.55}
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: "pointer" }}
                onPointerEnter={(ev) => showEdgeTip(e, ev)}
                onPointerMove={(ev) => showEdgeTip(e, ev)}
                onPointerLeave={clearTip}
              />
              <circle
                cx={midX}
                cy={midY}
                r={active ? 5 : 3.5}
                fill={REL_TYPE_COLORS[e.type]}
                opacity={active ? 1 : 0.75}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}

        {characters.map((c) => {
          const pos = positions[c.id];
          if (!pos) return null;
          const isFocus = focusId === c.id;
          const isHover = hoverNode === c.id;
          const r = isFocus || isHover ? 32 : 28;
          return (
            <g
              key={c.id}
              transform={`translate(${pos.x},${pos.y})`}
              onPointerDown={(e) => onPointerDown(c.id, e)}
              onPointerEnter={(e) => showNodeTip(c, e)}
              onPointerLeave={clearTip}
              style={{ cursor: dragging === c.id ? "grabbing" : "grab" }}
            >
              <circle
                r={r + 3}
                fill="none"
                stroke={isFocus ? "#a78bfa" : isHover ? "#c4b5fd" : "#7c3aed"}
                strokeWidth={isFocus ? 3 : 2}
                opacity={0.9}
              />
              <circle r={r} fill="#1a1a1a" />
              {c.avatar ? (
                <image
                  href={c.avatar}
                  x={-r + 2}
                  y={-r + 2}
                  width={(r - 2) * 2}
                  height={(r - 2) * 2}
                  clipPath={`circle(${r - 2}px at ${r - 2}px ${r - 2}px)`}
                  style={{ pointerEvents: "none" }}
                />
              ) : (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#a3a3a3"
                  fontSize={12}
                  style={{ pointerEvents: "none" }}
                >
                  {c.name.slice(0, 2)}
                </text>
              )}
              <text
                y={r + 16}
                textAnchor="middle"
                fill={isFocus ? "#e9d5ff" : "#e5e5e5"}
                fontSize={11}
                fontWeight={600}
                style={{ pointerEvents: "none" }}
              >
                {c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name}
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-neutral-600 bg-black/90 px-3 py-2 text-xs text-neutral-100 shadow-xl backdrop-blur"
          style={{
            left: Math.min(tooltip.x, size.w - 200),
            top: Math.min(tooltip.y, size.h - 80),
          }}
        >
          {tooltip.lines.map((line, i) => (
            <div
              key={i}
              className={i === 0 ? "font-semibold text-white mb-0.5" : "text-neutral-400"}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur rounded-lg p-2 text-[11px] space-y-1 border border-neutral-800">
        {Object.entries(REL_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded" style={{ background: color }} />
            <span className="text-neutral-400">
              {REL_TYPE_LABELS[type as Relationship["type"]]}
            </span>
          </div>
        ))}
        <div className="text-neutral-600 pt-1 border-t border-neutral-800 mt-1">
          拖动节点调整位置 · 悬停查看详情
        </div>
      </div>
    </div>
  );
}
