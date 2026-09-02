"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as REPointerEvent } from "react";

export type DockGeo = {
  w: number;
  h: number;
  x: number | null;
  y: number | null;
  fx: number | null;
  fy: number | null;
};

const RESET_EVENT = "oc-dock-reset";
export const DOCK_GEO_KEYS = [
  "oc-logs-geo-v1",
  "oc-zhihuiji-geo-v1",
  "oc-character-chat-geo-v1",
];

export function resetAllDockGeo() {
  if (typeof window === "undefined") return;
  for (const k of DOCK_GEO_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
  window.dispatchEvent(new Event(RESET_EVENT));
}

function load(key: string, fb: DockGeo): DockGeo {
  if (typeof window === "undefined") return fb;
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null") as Partial<DockGeo> | null;
    if (v && typeof v.w === "number" && typeof v.h === "number") {
      return {
        w: v.w,
        h: v.h,
        x: typeof v.x === "number" ? v.x : null,
        y: typeof v.y === "number" ? v.y : null,
        fx: typeof v.fx === "number" ? v.fx : null,
        fy: typeof v.fy === "number" ? v.fy : null,
      };
    }
  } catch { /* ignore */ }
  return fb;
}

function clamp(g: DockGeo): DockGeo {
  if (typeof window === "undefined") return g;
  const w = Math.min(Math.max(280, g.w), window.innerWidth - 16);
  const h = Math.min(Math.max(320, g.h), window.innerHeight - 16);
  const nx = g.x == null ? null : Math.min(Math.max(8, g.x), Math.max(8, window.innerWidth - 80));
  const ny = g.y == null ? null : Math.min(Math.max(8, g.y), Math.max(8, window.innerHeight - 80));
  const fx = g.fx == null ? null : Math.min(Math.max(8, g.fx), Math.max(8, window.innerWidth - 48));
  const fy = g.fy == null ? null : Math.min(Math.max(8, g.fy), Math.max(8, window.innerHeight - 48));
  return { w, h, x: nx, y: ny, fx, fy };
}

export function useDockGeo(
  storageKey: string,
  defaults?: { w?: number; h?: number; x?: number | null; y?: number | null; fab?: "end" | "start" }
) {
  const fabAlign = defaults?.fab ?? "end";
  const fb: DockGeo = {
    w: defaults?.w ?? 380,
    h: defaults?.h ?? 560,
    x: defaults?.x ?? null,
    y: defaults?.y ?? null,
    fx: null,
    fy: null,
  };
  const [geo, setGeo] = useState<DockGeo>(fb);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ ox: number; oy: number; w: number; h: number } | null>(null);
  const fabDragRef = useRef<{
    startX: number;
    startY: number;
    fabLeft: number;
    fabTop: number;
    moved: boolean;
  } | null>(null);

  const reload = useCallback(() => {
    setGeo(clamp(load(storageKey, fb)));
  }, [storageKey]);

  useEffect(() => {
    reload();
    window.addEventListener(RESET_EVENT, reload);
    return () => window.removeEventListener(RESET_EVENT, reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, reload]);

  const persist = useCallback((g: DockGeo) => {
    const n = clamp(g);
    try { localStorage.setItem(storageKey, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  }, [storageKey]);

  const panelStyle: CSSProperties = {
    width: geo.w,
    height: geo.h,
    ...(geo.x == null || geo.y == null
      ? fabAlign === "start"
        ? { left: 12, bottom: 56 }
        : { right: 16, bottom: 80 }
      : { left: geo.x, top: geo.y, right: "auto", bottom: "auto" }),
  };

  const fabStyle = (
    _size: number,
    fallback: { right?: number; bottom?: number; left?: number; top?: number }
  ): CSSProperties => {
    if (geo.fx != null && geo.fy != null) {
      return { left: geo.fx, top: geo.fy, right: "auto", bottom: "auto" };
    }
    return fallback;
  };

  const headerDrag = {
    onPointerDown: (e: REPointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      const r = panelRef.current?.getBoundingClientRect();
      if (!r) return;
      dragRef.current = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      setGeo((g) => persist({ ...g, x: r.left, y: r.top }));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: REPointerEvent<HTMLElement>) => {
      if (!dragRef.current) return;
      setGeo((g) =>
        persist({
          ...g,
          x: e.clientX - dragRef.current!.ox,
          y: e.clientY - dragRef.current!.oy,
        })
      );
    },
    onPointerUp: () => { dragRef.current = null; },
  };

  const resizeHandle = {
    onPointerDown: (e: REPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const r = panelRef.current?.getBoundingClientRect();
      if (!r) return;
      resizeRef.current = { ox: e.clientX, oy: e.clientY, w: r.width, h: r.height };
      setGeo((g) => persist({ ...g, x: r.left, y: r.top, w: r.width, h: r.height }));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: REPointerEvent<HTMLElement>) => {
      if (!resizeRef.current) return;
      const s = resizeRef.current;
      setGeo((g) =>
        persist({
          ...g,
          w: s.w + (e.clientX - s.ox),
          h: s.h + (e.clientY - s.oy),
        })
      );
    },
    onPointerUp: () => { resizeRef.current = null; },
  };

  const fabDrag = (onClick: () => void) => ({
    onPointerDown: (e: REPointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      fabDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        fabLeft: r.left,
        fabTop: r.top,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: REPointerEvent<HTMLElement>) => {
      const d = fabDragRef.current;
      if (!d) return;
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < 6) return;
      d.moved = true;
      setGeo((g) =>
        persist({
          ...g,
          fx: d.fabLeft + (e.clientX - d.startX),
          fy: d.fabTop + (e.clientY - d.startY),
        })
      );
    },
    onPointerUp: () => {
      const d = fabDragRef.current;
      fabDragRef.current = null;
      if (!d?.moved) onClick();
    },
  });

  return { geo, panelRef, panelStyle, fabStyle, headerDrag, resizeHandle, fabDrag, reset: () => resetAllDockGeo() };
}