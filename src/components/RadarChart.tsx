"use client";

interface Props {
  data: {
    experience: number;
    collaboration: number;
    conflict: number;
    intelligence: number;
    adaptability: number;
  };
  size?: number;
  editable?: boolean;
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
  editable = false,
  onChange,
}: Props) {
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

  const points = LABELS.map((l) => {
    const p = getPoint(data[l.key], l.angle);
    return `${p.x},${p.y}`;
  }).join(" ");

  // Grid polygons
  const grids = [20, 40, 60, 80, 100].map((pct) => {
    return LABELS.map((l) => {
      const p = getPoint(pct, l.angle);
      return `${p.x},${p.y}`;
    }).join(" ");
  });

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
              <circle cx={p.x} cy={p.y} r={4} fill="#c084fc" />
              <text
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-neutral-400 text-[10px]"
                style={{ fontSize: 10 }}
              >
                {l.label}
              </text>
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="fill-purple-300 text-[9px] font-medium"
                style={{ fontSize: 9 }}
              >
                {data[l.key]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
