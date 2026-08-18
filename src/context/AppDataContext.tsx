"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Character } from "@/lib/types";
import type { WorldMeta } from "@/lib/worlds";
import type { WorldCatalog } from "@/lib/worldCatalog";
import type { WorldLoreMap } from "@/lib/worldLore";
import { normalizeLoreMap } from "@/lib/worldLore";
import { fetchAppData } from "@/lib/apiClient";
import { normalizeCharacterList } from "@/lib/storage";

interface AppDataState {
  characters: Character[];
  worlds: WorldMeta[];
  catalog: WorldCatalog;
  lore: WorldLoreMap;
  loaded: boolean;
  syncError: string | null;
  setCharacters: (
    next: Character[] | ((prev: Character[]) => Character[])
  ) => void;
  setWorlds: (next: WorldMeta[] | ((prev: WorldMeta[]) => WorldMeta[])) => void;
  setCatalog: (
    next: WorldCatalog | ((prev: WorldCatalog) => WorldCatalog)
  ) => void;
  setLore: (next: WorldLoreMap | ((prev: WorldLoreMap) => WorldLoreMap)) => void;
  flush: (patch?: {
    characters?: Character[];
    worlds?: WorldMeta[];
    catalog?: WorldCatalog;
    lore?: WorldLoreMap;
  }) => Promise<void>;
  reload: () => Promise<void>;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [characters, setCharactersState] = useState<Character[]>([]);
  const [worlds, setWorldsState] = useState<WorldMeta[]>([]);
  const [catalog, setCatalogState] = useState<WorldCatalog>({});
  const [lore, setLoreState] = useState<WorldLoreMap>({});
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const charsRef = useRef<Character[]>([]);
  const worldsRef = useRef<WorldMeta[]>([]);
  const catalogRef = useRef<WorldCatalog>({});
  const loreRef = useRef<WorldLoreMap>({});
  /** Only skip the auto-save that would fire right after initial load / reload. */
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Serialize network saves so older in-flight PUTs cannot finish out of order. */
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    charsRef.current = characters;
  }, [characters]);
  useEffect(() => {
    worldsRef.current = worlds;
  }, [worlds]);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);
  useEffect(() => {
    loreRef.current = lore;
  }, [lore]);

  const reload = useCallback(async () => {
    try {
      const data = await fetchAppData();
      const list = normalizeCharacterList(data.characters);
      charsRef.current = list;
      worldsRef.current = data.worlds || [];
      catalogRef.current = data.catalog || {};
      loreRef.current = normalizeLoreMap(
        (data as { lore?: unknown }).lore
      );
      setCharactersState(list);
      setWorldsState(data.worlds || []);
      setCatalogState(data.catalog || {});
      setLoreState(loreRef.current);
      setSyncError(null);
      skipSave.current = true;
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const persist = useCallback(
    async (patch?: {
      characters?: Character[];
      worlds?: WorldMeta[];
      catalog?: WorldCatalog;
      lore?: WorldLoreMap;
    }) => {
      // Queue behind previous saves. Read latest refs at execution time so a
      // deferred task still writes the newest local snapshot (including lore).
      const run = async () => {
        const body = {
          characters:
            patch && "characters" in patch
              ? patch.characters ?? []
              : charsRef.current,
          worlds:
            patch && "worlds" in patch
              ? patch.worlds ?? []
              : worldsRef.current,
          catalog:
            patch && "catalog" in patch
              ? patch.catalog ?? {}
              : catalogRef.current,
          lore:
            patch && "lore" in patch ? patch.lore ?? {} : loreRef.current,
        };

        const res = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        // Do NOT re-hydrate React state from the response.
        // Applying the server payload after every debounced save caused:
        // "add lore entry → appears → vanishes → reappears" when an older
        // in-flight PUT completed after a newer local edit.
        await res.json().catch(() => null);
        setSyncError(null);
      };

      const next = saveChain.current.then(run, run);
      saveChain.current = next.catch(() => {});
      try {
        await next;
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : "保存失败");
        throw e;
      }
    },
    []
  );

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist().catch(() => {});
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [characters, worlds, catalog, lore, loaded, persist]);

  const setCharacters = useCallback(
    (next: Character[] | ((prev: Character[]) => Character[])) => {
      setCharactersState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        charsRef.current = value;
        return value;
      });
    },
    []
  );

  const setWorlds = useCallback(
    (next: WorldMeta[] | ((prev: WorldMeta[]) => WorldMeta[])) => {
      setWorldsState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        worldsRef.current = value;
        return value;
      });
    },
    []
  );

  const setCatalog = useCallback(
    (next: WorldCatalog | ((prev: WorldCatalog) => WorldCatalog)) => {
      setCatalogState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        catalogRef.current = value;
        return value;
      });
    },
    []
  );

  const setLore = useCallback(
    (next: WorldLoreMap | ((prev: WorldLoreMap) => WorldLoreMap)) => {
      setLoreState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        loreRef.current = value;
        return value;
      });
    },
    []
  );

  const flush = useCallback(
    async (patch?: {
      characters?: Character[];
      worlds?: WorldMeta[];
      catalog?: WorldCatalog;
      lore?: WorldLoreMap;
    }) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (patch && "characters" in patch) {
        const list = patch.characters ?? [];
        charsRef.current = list;
        setCharactersState(list);
      }
      if (patch && "worlds" in patch) {
        const list = patch.worlds ?? [];
        worldsRef.current = list;
        setWorldsState(list);
      }
      if (patch && "catalog" in patch) {
        const cat = patch.catalog ?? {};
        catalogRef.current = cat;
        setCatalogState(cat);
      }
      if (patch && "lore" in patch) {
        const l = patch.lore ?? {};
        loreRef.current = l;
        setLoreState(l);
      }
      await persist(patch);
    },
    [persist]
  );

  return (
    <AppDataContext.Provider
      value={{
        characters,
        worlds,
        catalog,
        lore,
        loaded,
        syncError,
        setCharacters,
        setWorlds,
        setCatalog,
        setLore,
        flush,
        reload,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
