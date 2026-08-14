"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RelationshipGraph from "@/components/RelationshipGraph";
import { useCharacters } from "@/hooks/useCharacters";
import { useWorlds } from "@/hooks/useWorlds";

export default function WorldRelationshipsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
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

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-neutral-400">World not found</p>
            <Link href="/" className="text-purple-400 text-sm hover:underline">
              ← Back to Worlds
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={world.color} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href={`/world/${id}`}
              className="text-neutral-500 hover:text-white text-sm"
            >
              ← {world.name}
            </Link>
            <h1 className="text-2xl font-bold text-white mt-1">关系图</h1>
            <p className="text-neutral-500 text-sm mt-1">
              拖动角色节点调整布局。连线颜色表示关系类型；悬停可查看完整名字与关系。
              在角色卡中添加的关系会双向同步。点击节点进入角色卡。
            </p>
          </div>
          <div className="text-sm text-neutral-500">
            {characters.length} 角色 ·{" "}
            {characters.reduce((n, c) => n + (c.relationships?.length || 0), 0) / 2} 对关系
          </div>
        </div>

        <RelationshipGraph
          characters={characters}
          height={560}
          storageKey={`oc-rel-graph-${id}`}
          onNodeClick={(cid) => router.push(`/character/${cid}`)}
        />
      </main>
      <Footer />
    </div>
  );
}
