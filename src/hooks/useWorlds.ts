"use client";

import { useCallback, useMemo } from "react";
import {
  WorldMeta,
  createWorldId,
  migrateWorldsFromCharacters,
  WORLD_COLOR_PALETTE,
} from "@/lib/worlds";
import { useAppData } from "@/context/AppDataContext";

export function useWorlds() {
  const {
    worlds,
    characters,
    loaded,
    setWorlds,
    setCharacters,
    flush,
    reload,
  } = useAppData();

  // Display helper only — does not auto-write deleted worlds back
  const ensured = useMemo(
    () =>
      migrateWorldsFromCharacters(
        worlds,
        characters.map((c) => c.world || "").filter(Boolean)
      ),
    [worlds, characters]
  );

  const addWorld = useCallback(
    (name: string, color?: string, system?: WorldMeta["system"]) => {
      const now = new Date().toISOString();
      const w: WorldMeta = {
        id: createWorldId(),
        name: name.trim(),
        color: color || WORLD_COLOR_PALETTE[0],
        system: system || "generic",
        dmRoster: [],
        createdAt: now,
        updatedAt: now,
      };
      setWorlds((prev) => {
        if (prev.some((x) => x.name === w.name)) return prev;
        return [...prev, w];
      });
      return w;
    },
    [setWorlds]
  );

  const updateWorld = useCallback(
    (
      id: string,
      updates: Partial<Pick<WorldMeta, "name" | "color" | "system" | "dmRoster">>
    ) => {
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
      const target = worlds.find((w) => w.id === id);
      if (!target) return;
      const nextWorlds = worlds.filter((w) => w.id !== id);
      // Unassign characters so the world is not recreated from character.world
      const nextChars = characters.map((c) =>
        c.world?.trim() === target.name
          ? { ...c, world: "", updatedAt: new Date().toISOString() }
          : c
      );
      setCharacters(nextChars);
      setWorlds(nextWorlds);
      await flush({ worlds: nextWorlds, characters: nextChars });
    },
    [worlds, characters, setWorlds, setCharacters, flush]
  );

  const getWorld = useCallback(
    (id: string) =>
      worlds.find((w) => w.id === id) ?? ensured.find((w) => w.id === id),
    [worlds, ensured]
  );

  const getWorldByName = useCallback(
    (name: string) =>
      worlds.find((w) => w.name === name.trim()) ??
      ensured.find((w) => w.name === name.trim()),
    [worlds, ensured]
  );

  const replaceAll = useCallback(
    async (list: WorldMeta[]) => {
      await flush({ worlds: list });
    },
    [flush]
  );

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
