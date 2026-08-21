"use client";

import { useRef, useCallback } from "react";
import type { RadarAxis } from "@/lib/types";

interface Props {
  axes: RadarAxis[];
  size?: number;
  onChange?: (id: string, value: number) => void;
}

export default function RadarChart({ axes, size = 200, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const n = Math.max(3, axes.length);

  const angleOf = (i: number) => -90 + (360 / n) * i;

  const getPoint = (value: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = (value / 100) * maxR;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const valueFromPointer = useCallback(
    (clientX: number, clientY: number, angleDeg: number) => {
      if (!svgRef.current) return 50;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const mx = (clientX - rect.left) * scaleX - cx;
      const my = (clientY - rect.top) * scaleY - cy;
      const rad = (angleDeg * Math.PI) / 180;
      const proj = mx * Math.cos(rad) + my * Math.sin(rad);
      const clamped = Math.max(0, Math.min(maxR, proj));
      return Math.round((clamped / maxR) * 100);
    },
    [size, cx, cy, maxR]
  );

  const handlePointerDown =
    (id: string, angle: number) => (e: React.PointerEvent) => {
      if (!onChange) return;
      e.preventDefault();
      e.stopPropagation();
      dragging.current = id;
      (e.target as Element).setPointerCapture?.(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const val = valueFromPointer(ev.clientX, ev.clientY, angle);
        onChange(dragging.current, val);
      };
      const onUp = () => {
        dragging.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  const points = axes
    .map((ax, i) => {
      const p = getPoint(ax.value, angleOf(i));
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const grids = [20, 40, 60, 80, 100].map((pct) =>
    axes
      .map((_, i) => {
        const p = getPoint(pct, angleOf(i));
        return `${p.x},${p.y}`;
      })
      .join(" ")
  );

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={onChange ? "cursor-default" : ""}
      >
        {grids.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="#333"
            strokeWidth={1}
          />
        ))}
        {axes.map((ax, i) => {
          const p = getPoint(100, angleOf(i));
          return (
            <line
              key={ax.id}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="#444"
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={points}
          fill="rgba(168, 85, 247, 0.25)"
          stroke="#a855f7"
          strokeWidth={2}
        />
        {axes.map((ax, i) => {
          const angle = angleOf(i);
          const p = getPoint(ax.value, angle);
          const labelP = getPoint(118, angle);
          return (
            <g key={ax.id}>
              {onChange && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={handlePointerDown(ax.id, angle)}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill="#c084fc"
                stroke="#fff"
                strokeWidth={1.5}
                className={onChange ? "pointer-events-none" : ""}
              />
              <text
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#a3a3a3"
                style={{ fontSize: 10 }}
              >
                {ax.label}
              </text>
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fill="#d8b4fe"
                style={{ fontSize: 10, fontWeight: 600 }}
                className="pointer-events-none"
              >
                {ax.value}
              </text>
            </g>
          );
        })}
      </svg>
      {onChange && (
        <p className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-neutral-500 pointer-events-none">
          拖动圆点调整数值
        </p>
      )}
    </div>
  );
}
