"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as REPointerEvent } from "react";

export type DockGeo = { w: number; h: number; x: number | null; y: number | null };

function load(key: string, fb: DockGeo): DockGeo {
  if (typeof window === "undefined") return fb;
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null") as DockGeo | null;
    if (v && typeof v.w === "number" && typeof v.h === "number") return v;
  } catch { /* ignore */ }
  return fb;
}

function clamp(g: DockGeo): DockGeo {
  if (typeof window === "undefined") return g;
  const w = Math.min(Math.max(280, g.w), window.innerWidth - 16);
  const h = Math.min(Math.max(320, g.h), window.innerHeight - 16);
  if (g.x == null || g.y == null) return { w, h, x: null, y: null };
  return {
    w,
    h,
    x: Math.min(Math.max(8, g.x), Math.max(8, window.innerWidth - 80)),
    y: Math.min(Math.max(8, g.y), Math.max(8, window.innerHeight - 80)),
  };
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
    size: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setGeo(clamp(load(storageKey, fb)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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
        ? { left: 12, top: 56 }
        : { right: 16, bottom: 80 }
      : { left: geo.x, top: geo.y, right: "auto", bottom: "auto" }),
  };

  const fabStyle = (
    size: number,
    fallback: { right?: number; bottom?: number; left?: number; top?: number }
  ): CSSProperties => {
    if (fabAlign === "start") {
      if (geo.x == null || geo.y == null) {
        return { left: fallback.left ?? 12, top: fallback.top ?? 12 };
      }
      return { left: geo.x, top: geo.y, right: "auto", bottom: "auto" };
    }
    if (geo.x == null || geo.y == null) {
      return { right: fallback.right, bottom: fallback.bottom };
    }
    return {
      left: geo.x + geo.w - size,
      top: geo.y + geo.h + 8,
      right: "auto",
      bottom: "auto",
    };
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

  const fabDrag = (onClick: () => void, size: number) => ({
    onPointerDown: (e: REPointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      fabDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        fabLeft: r.left,
        fabTop: r.top,
        size,
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
      if (fabAlign === "start") {
        setGeo((g) =>
          persist({
            ...g,
            x: d.fabLeft + (e.clientX - d.startX),
            y: d.fabTop + (e.clientY - d.startY),
          })
        );
        return;
      }
      setGeo((g) =>
        persist({
          ...g,
          x: d.fabLeft + d.size - g.w + (e.clientX - d.startX),
          y: d.fabTop - 8 - g.h + (e.clientY - d.startY),
        })
      );
    },
    onPointerUp: () => {
      const d = fabDragRef.current;
      fabDragRef.current = null;
      if (!d?.moved) onClick();
    },
  });

  return { geo, panelRef, panelStyle, fabStyle, headerDrag, resizeHandle, fabDrag };
}