"use client";

import { useCallback } from "react";
import {
  WorldCatalog,
  OptionField,
  ensureWorld,
  addOption,
  getOptions,
  listWorlds,
} from "@/lib/worldCatalog";
import { useAppData } from "@/context/AppDataContext";
import {
  getLore,
  locationNames,
  factionNames,
  raceNames,
} from "@/lib/worldLore";
import { useWorlds } from "@/hooks/useWorlds";

export function useWorldCatalog() {
  const { catalog, lore, loaded, setCatalog } = useAppData();
  const { worlds: worldMetas } = useWorlds();

  const createWorld = useCallback(
    (world: string) => {
      setCatalog((prev) => ensureWorld(prev, world));
    },
    [setCatalog]
  );

  const addFieldOption = useCallback(
    (world: string, field: OptionField, value: string) => {
      setCatalog((prev) => addOption(prev, world, field, value));
    },
    [setCatalog]
  );

  const optionsFor = useCallback(
    (world: string, field: OptionField) => {
      const base = getOptions(catalog, world, field);
      // Resolve world id for lore lookup (lore is keyed by world id)
      const meta = worldMetas.find((w) => w.name === world.trim());
      const wLore = getLore(lore || {}, meta?.id || world);
      if (field === "birthplaces" || field === "residences") {
        return locationNames(wLore, base);
      }
      if (field === "factions") {
        return factionNames(wLore, base);
      }
      if (field === "races") {
        return raceNames(wLore, base);
      }
      return base;
    },
    [catalog, lore, worldMetas]
  );

  const worlds = listWorlds(catalog);

  const replaceAll = useCallback(
    (c: WorldCatalog) => {
      setCatalog(c);
    },
    [setCatalog]
  );

  return {
    catalog,
    loaded,
    worlds,
    createWorld,
    addFieldOption,
    optionsFor,
    replaceAll,
  };
}
