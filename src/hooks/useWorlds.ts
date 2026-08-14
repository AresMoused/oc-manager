"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  WorldMeta,
  createWorldId,
  migrateWorldsFromCharacters,
  WORLD_COLOR_PALETTE,
} from "@/lib/worlds";
import { useAppData } from "@/context/AppDataContext";

export function useWorlds() {
  const { worlds, characters, loaded, setWorlds, flush, reload } = useAppData();

  const ensured = useMemo(
    () =>
      migrateWorldsFromCharacters(
        worlds,
        characters.map((c) => c.world || "").filter(Boolean)
      ),
    [worlds, characters]
  );

  useEffect(() => {
    if (!loaded) return;
    if (ensured.length > worlds.length) {
      setWorlds(ensured);
    }
  }, [loaded, ensured, worlds.length, setWorlds]);

  const addWorld = useCallback(
    (name: string, color?: string) => {
      const now = new Date().toISOString();
      const w: WorldMeta = {
        id: createWorldId(),
        name: name.trim(),
        color: color || WORLD_COLOR_PALETTE[0],
        createdAt: now,
        updatedAt: now,
      };
      setWorlds((prev) => [...prev, w]);
      return w;
    },
    [setWorlds]
  );

  const updateWorld = useCallback(
    (id: string, updates: Partial<Pick<WorldMeta, "name" | "color">>) => {
      setWorlds((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, ...updates, updatedAt: new Date().toISOString() }
            : w
        )
      );
    },
    [setWorlds]
  );

  const deleteWorld = useCallback(
    async (id: string) => {
      const next = worlds.filter((w) => w.id !== id);
      await flush({ worlds: next });
    },
    [worlds, flush]
  );

  const getWorld = useCallback(
    (id: string) => ensured.find((w) => w.id === id),
    [ensured]
  );

  const getWorldByName = useCallback(
    (name: string) => ensured.find((w) => w.name === name.trim()),
    [ensured]
  );

  const replaceAll = useCallback(
    async (list: WorldMeta[]) => {
      await flush({ worlds: list });
    },
    [flush]
  );

  return {
    worlds: ensured,
    loaded,
    reload,
    addWorld,
    updateWorld,
    deleteWorld,
    getWorld,
    getWorldByName,
    replaceAll,
  };
}
