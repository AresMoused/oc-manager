"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WorldCatalog,
  OptionField,
  loadWorldCatalog,
  saveWorldCatalog,
  ensureWorld,
  addOption,
  getOptions,
  listWorlds,
} from "@/lib/worldCatalog";

export function useWorldCatalog() {
  const [catalog, setCatalog] = useState<WorldCatalog>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCatalog(loadWorldCatalog());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveWorldCatalog(catalog);
  }, [catalog, loaded]);

  const createWorld = useCallback((world: string) => {
    setCatalog((prev) => ensureWorld(prev, world));
  }, []);

  const addFieldOption = useCallback(
    (world: string, field: OptionField, value: string) => {
      setCatalog((prev) => addOption(prev, world, field, value));
    },
    []
  );

  const optionsFor = useCallback(
    (world: string, field: OptionField) => getOptions(catalog, world, field),
    [catalog]
  );

  const worlds = listWorlds(catalog);

  return {
    catalog,
    loaded,
    worlds,
    createWorld,
    addFieldOption,
    optionsFor,
  };
}
