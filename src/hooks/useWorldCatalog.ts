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

export function useWorldCatalog() {
  const { catalog, loaded, setCatalog } = useAppData();

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
    (world: string, field: OptionField) => getOptions(catalog, world, field),
    [catalog]
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
