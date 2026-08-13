"use client";

import { use, useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCharacters } from "@/hooks/useCharacters";
import { useWorlds } from "@/hooks/useWorlds";
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

export default function WorldRelationshipsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getWorld, loaded: worldsLoaded } = useWorlds();
  const { characters: allCharacters, loaded: charsLoaded } = useCharacters();
  const world = getWorld(id);
  const loaded = worldsLoaded && charsLoaded;
  const characters = useMemo(
    () =>
      world
        ? allCharacters.filter((c) => c.world?.trim() === world.name)
        : [],
    [allCharacters, world]
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

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

  const edges = useMemo(() => {
    const list: {
      from: string;
      to: string;
      type: Relationship["type"];
      strength: number;
    }[] = [];
    const seen = new Set<string>();
    characters.forEach((c) => {
      (c.relationships || []).forEach((r) => {
        if (!characters.find((x) => x.id === r.targetId)) return;
        const key = [c.id, r.targetId].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        list.push({
          from: c.id,
          to: r.targetId,
          type: r.type,
          strength: r.strength,
        });
      });
    });
    return list;
  }, [characters]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      setPositions((prev) => ({
        ...prev,
        [dragging]: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-400">World not found</p>
        <Link href="/" className="text-purple-400 text-sm hover:underline">
          ← Back to Worlds
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={world.color} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/world/${id}`}
              className="text-neutral-400 hover:text-white text-sm"
            >
              ← {world.name}
            </Link>
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: world.color }}
            />
            <h1 className="text-2xl font-bold text-white">Relationship Map</h1>
          </div>
          <p className="text-neutral-500 text-sm mt-1">
            Drag nodes to rearrange. Only characters in this world are shown.
          </p>
        </div>

        {characters.length < 2 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500 border border-dashed border-neutral-700 rounded-xl">
            Need at least 2 characters in this world to display the map.
          </div>
        ) : (
          <div className="flex-1 min-h-[500px] border border-neutral-800 rounded-xl bg-[#0c0c0c] overflow-hidden">
            <svg ref={svgRef} width="100%" height="100%" className="w-full h-full">
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
                    strokeWidth={Math.max(1, e.strength / 2)}
                    strokeOpacity={0.6}
                  />
                );
              })}
              {characters.map((c) => {
                const pos = positions[c.id];
                if (!pos) return null;
                return (
                  <g
                    key={c.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      setDragging(c.id);
                    }}
                  >
                    <circle
                      r={28}
                      fill="#1a1a1a"
                      stroke={world.color}
                      strokeWidth={2}
                    />
                    <text
                      textAnchor="middle"
                      y={5}
                      fill="#e5e5e5"
                      fontSize={11}
                      className="select-none pointer-events-none"
                    >
                      {c.name.slice(0, 6)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-500">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              {type}
            </span>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
