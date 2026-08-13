"use client";

import { useRef, useCallback } from "react";

interface Props {
  data: {
    experience: number;
    collaboration: number;
    conflict: number;
    intelligence: number;
    adaptability: number;
  };
  size?: number;
  onChange?: (key: keyof Props["data"], value: number) => void;
}

const LABELS = [
  { key: "experience" as const, label: "经验", angle: -90 },
  { key: "adaptability" as const, label: "应变", angle: -18 },
  { key: "intelligence" as const, label: "智取", angle: 54 },
  { key: "conflict" as const, label: "冲突", angle: 126 },
  { key: "collaboration" as const, label: "协作", angle: 198 },
];

export default function RadarChart({
  data,
  size = 200,
  onChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<keyof Props["data"] | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;

  const getPoint = (value: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = (value / 100) * maxR;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  /** Convert mouse position to a 0–100 value along the axis of a given angle */
  const valueFromPointer = useCallback(
    (clientX: number, clientY: number, angleDeg: number) => {
      if (!svgRef.current) return 50;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const mx = (clientX - rect.left) * scaleX - cx;
      const my = (clientY - rect.top) * scaleY - cy;

      const rad = (angleDeg * Math.PI) / 180;
      // Project mouse vector onto the axis direction
      const proj = mx * Math.cos(rad) + my * Math.sin(rad);
      const clamped = Math.max(0, Math.min(maxR, proj));
      return Math.round((clamped / maxR) * 100);
    },
    [size, cx, cy, maxR]
  );

  const handlePointerDown = (key: keyof Props["data"], angle: number) => (e: React.PointerEvent) => {
    if (!onChange) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = key;
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

  const points = LABELS.map((l) => {
    const p = getPoint(data[l.key], l.angle);
    return `${p.x},${p.y}`;
  }).join(" ");

  const grids = [20, 40, 60, 80, 100].map((pct) => {
    return LABELS.map((l) => {
      const p = getPoint(pct, l.angle);
      return `${p.x},${p.y}`;
    }).join(" ");
  });

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={onChange ? "cursor-default" : ""}
      >
        {/* Grid */}
        {grids.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="#333"
            strokeWidth={1}
          />
        ))}
        {/* Axes */}
        {LABELS.map((l) => {
          const p = getPoint(100, l.angle);
          return (
            <line
              key={l.key}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="#444"
              strokeWidth={1}
            />
          );
        })}
        {/* Data polygon */}
        <polygon
          points={points}
          fill="rgba(168, 85, 247, 0.25)"
          stroke="#a855f7"
          strokeWidth={2}
        />
        {/* Data points + values */}
        {LABELS.map((l) => {
          const p = getPoint(data[l.key], l.angle);
          const labelP = getPoint(118, l.angle);
          return (
            <g key={l.key}>
              {/* Larger invisible hit area for easier dragging */}
              {onChange && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={handlePointerDown(l.key, l.angle)}
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
                {l.label}
              </text>
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fill="#d8b4fe"
                style={{ fontSize: 10, fontWeight: 600 }}
                className="pointer-events-none"
              >
                {data[l.key]}
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
