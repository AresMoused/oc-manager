"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  Children,
  isValidElement,
  ReactNode,
} from "react";

interface Props {
  children: ReactNode;
  storageKey: string;
  className?: string;
}

/**
 * Horizontal resizable row. Drag handles between panels to resize;
 * sibling panels adapt so the row stays full width.
 * Stacks vertically below `lg` breakpoint.
 */
export default function ResizableRow({
  children,
  storageKey,
  className = "",
}: Props) {
  const items = Children.toArray(children).filter(isValidElement);
  const n = items.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [isLg, setIsLg] = useState(false);

  const equal = Array.from({ length: n }, () => 100 / Math.max(n, 1));

  const [sizes, setSizes] = useState<number[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`oc-layout-${storageKey}`);
        if (raw) {
          const parsed = JSON.parse(raw) as number[];
          if (Array.isArray(parsed) && parsed.length === n) return parsed;
        }
      } catch {
        /* ignore */
      }
    }
    return equal;
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (sizes.length !== n) setSizes(equal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    try {
      localStorage.setItem(`oc-layout-${storageKey}`, JSON.stringify(sizes));
    } catch {
      /* ignore */
    }
  }, [sizes, storageKey]);

  const onPointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = index;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current === null || !containerRef.current) return;
    const idx = dragging.current;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;

    setSizes((prev) => {
      const next = [...prev];
      const minSize = 12;
      const leftSum = prev.slice(0, idx).reduce((a, b) => a + b, 0);
      const pair = prev[idx] + prev[idx + 1];
      let left = pct - leftSum;
      left = Math.max(minSize, Math.min(pair - minSize, left));
      next[idx] = left;
      next[idx + 1] = pair - left;
      return next;
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  if (n === 0) return null;
  if (n === 1) return <div className={className}>{items[0]}</div>;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col lg:flex-row items-stretch gap-3 lg:gap-0 ${className}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {items.map((child, i) => (
        <div key={i} className="contents">
          <div
            className="min-w-0"
            style={
              isLg
                ? {
                    width: `${sizes[i] ?? equal[i]}%`,
                    flexShrink: 0,
                    flexGrow: 0,
                  }
                : { width: "100%" }
            }
          >
            {child}
          </div>
          {i < n - 1 && (
            <div
              className="hidden lg:flex w-2 flex-shrink-0 cursor-col-resize items-stretch justify-center group z-10 select-none"
              onPointerDown={(e) => onPointerDown(i, e)}
              title="拖动调整宽度 · Drag to resize"
            >
              <div className="w-0.5 my-3 rounded-full bg-neutral-700 group-hover:bg-purple-500 group-active:bg-purple-400 transition-colors" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
