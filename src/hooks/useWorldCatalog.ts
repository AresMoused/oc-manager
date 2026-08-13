"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  WorldCatalog,
  OptionField,
  ensureWorld,
  addOption,
  getOptions,
  listWorlds,
} from "@/lib/worldCatalog";
import { fetchAppData, putCatalog } from "@/lib/apiClient";

export function useWorldCatalog() {
  const [catalog, setCatalog] = useState<WorldCatalog>({});
  const [loaded, setLoaded] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchAppData()
      .then((data) => {
        setCatalog(data.catalog || {});
        skipSave.current = true;
      })
      .catch(console.warn)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      putCatalog(catalog).catch(console.warn);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
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

  const replaceAll = useCallback((c: WorldCatalog) => {
    setCatalog(c);
  }, []);

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
