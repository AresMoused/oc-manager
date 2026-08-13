"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  WorldMeta,
  createWorldId,
  migrateWorldsFromCharacters,
  WORLD_COLOR_PALETTE,
} from "@/lib/worlds";
import { fetchAppData, putWorlds } from "@/lib/apiClient";

export function useWorlds() {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchAppData();
      let list = data.worlds || [];
      const names = (data.characters || [])
        .map((c) => c.world || "")
        .filter(Boolean);
      list = migrateWorldsFromCharacters(list, names);
      setWorlds(list);
      skipSave.current = true;
      if (list.length !== (data.worlds || []).length) {
        skipSave.current = false;
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      putWorlds(worlds).catch(console.warn);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [worlds, loaded]);

  const addWorld = useCallback((name: string, color?: string) => {
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
    (name: string) => worlds.find((w) => w.name === name.trim()),
    [worlds]
  );

  const replaceAll = useCallback((list: WorldMeta[]) => {
    setWorlds(list);
  }, []);

  return {
    worlds,
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
