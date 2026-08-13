"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WorldMeta,
  loadWorlds,
  saveWorlds,
  createWorldId,
  migrateWorldsFromCharacters,
  WORLD_COLOR_PALETTE,
} from "@/lib/worlds";
import { loadCharacters } from "@/lib/storage";

export function useWorlds() {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let list = loadWorlds();
    const chars = loadCharacters();
    const names = chars.map((c) => c.world || "").filter(Boolean);
    const migrated = migrateWorldsFromCharacters(list, names);
    if (migrated.length !== list.length) {
      saveWorlds(migrated);
      list = migrated;
    }
    setWorlds(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveWorlds(worlds);
  }, [worlds, loaded]);

  const addWorld = useCallback((name: string, color?: string) => {
    const now = new Date().toISOString();
    const w: WorldMeta = {
      id: createWorldId(),
      name: name.trim(),
      color:
        color ||
        WORLD_COLOR_PALETTE[Math.floor(Math.random() * WORLD_COLOR_PALETTE.length)],
      createdAt: now,
      updatedAt: now,
    };
    setWorlds((prev) => {
      if (prev.some((x) => x.name === w.name)) return prev;
      return [...prev, w];
    });
    return w;
  }, []);

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
    []
  );

  const deleteWorld = useCallback((id: string) => {
    setWorlds((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const getWorld = useCallback(
    (id: string) => worlds.find((w) => w.id === id),
    [worlds]
  );

  const getWorldByName = useCallback(
    (name: string) => worlds.find((w) => w.name === name),
    [worlds]
  );

  return {
    worlds,
    loaded,
    addWorld,
    updateWorld,
    deleteWorld,
    getWorld,
    getWorldByName,
  };
}
