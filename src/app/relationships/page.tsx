"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useCharacters } from "@/hooks/useCharacters";
import { Relationship } from "@/lib/types";

const TYPE_COLORS: Record<Relationship["type"], string> = {
  friend: "#34d399",
  family: "#38bdf8",
  ally: "#60a5fa",
  enemy: "#f87171",
  rival: "#fbbf24",
  lover: "#f472b6",
  mentor: "#a78bfa",
  other: "#a3a3a3",
};

export default function RelationshipsPage() {
  const { characters, loaded } = useCharacters();
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Initialize positions in a circle
  useEffect(() => {
    if (!loaded || characters.length === 0) return;
    const centerX = size.w / 2;
    const centerY = size.h / 2;
    const radius = Math.min(size.w, size.h) * 0.35;
    const newPos: Record<string, { x: number; y: number }> = {};
    characters.forEach((c, i) => {
      if (positions[c.id]) {
        newPos[c.id] = positions[c.id];
      } else {
        const angle = (i / characters.length) * Math.PI * 2 - Math.PI / 2;
        newPos[c.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      }
    });
    setPositions(newPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, characters.length, size.w, size.h]);

  useEffect(() => {
    const update = () => {
      if (svgRef.current) {
        const rect = svgRef.current.parentElement?.getBoundingClientRect();
        if (rect) setSize({ w: rect.width, h: Math.max(500, rect.height) });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Collect all edges
  const edges = useMemo(() => {
    const list: {
      from: string;
      to: string;
      type: Relationship["type"];
      strength: number;
    }[] = [];
    const seen = new Set<string>();
    characters.forEach((c) => {
      c.relationships.forEach((r) => {
        const key = [c.id, r.targetId].sort().join("-");
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            from: c.id,
            to: r.targetId,
            type: r.type,
            strength: r.strength,
          });
        }
      });
    });
    return list;
  }, [characters]);

  const handleMouseDown = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(id);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPositions((prev) => ({
        ...prev,
        [dragging]: { x, y },
      }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">Relationship Map</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Drag nodes to rearrange. Lines show connections between characters.
          </p>
        </div>

        {characters.length < 2 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500 border border-dashed border-neutral-700 rounded-xl">
            Need at least 2 characters with relationships to display the map.
          </div>
        ) : (
          <div className="flex-1 min-h-[500px] bg-[#0d0d0d] border border-neutral-800 rounded-xl overflow-hidden relative">
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ minHeight: 500 }}
              className="select-none"
            >
              {/* Edges */}
              {edges.map((e, i) => {
                const from = positions[e.from];
                const to = positions[e.to];
                if (!from || !to) return null;
                return (
                  <line
                    key={i}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={TYPE_COLORS[e.type]}
                    strokeWidth={1 + e.strength}
                    strokeOpacity={0.6}
                  />
                );
              })}
              {/* Nodes */}
              {characters.map((c) => {
                const pos = positions[c.id];
                if (!pos) return null;
                return (
                  <g
                    key={c.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    onMouseDown={handleMouseDown(c.id)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <circle
                      r={28}
                      fill="#1a1a1a"
                      stroke="#7c3aed"
                      strokeWidth={2}
                    />
                    {c.avatar ? (
                      <image
                        href={c.avatar}
                        x={-24}
                        y={-24}
                        width={48}
                        height={48}
                        clipPath="circle(24px at 24px 24px)"
                        style={{ pointerEvents: "none" }}
                      />
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#888"
                        fontSize={12}
                      >
                        {c.name.slice(0, 2)}
                      </text>
                    )}
                    <text
                      y={40}
                      textAnchor="middle"
                      fill="#e5e5e5"
                      fontSize={11}
                      fontWeight={500}
                    >
                      {c.name.length > 12 ? c.name.slice(0, 11) + "…" : c.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur rounded-lg p-2 text-xs space-y-1">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-0.5 rounded"
                    style={{ background: color }}
                  />
                  <span className="text-neutral-400 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
