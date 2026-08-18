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
  mergeNames,
} from "@/lib/worldLore";

export function useWorldCatalog() {
  const { catalog, lore, loaded, setCatalog } = useAppData();

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
      const wLore = getLore(lore || {}, world);
      if (field === "birthplaces" || field === "residences") {
        return mergeNames(base, locationNames(wLore));
      }
      if (field === "factions") {
        return mergeNames(base, factionNames(wLore));
      }
      if (field === "races") {
        return mergeNames(base, raceNames(wLore));
      }
      return base;
    },
    [catalog, lore]
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
