"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Character,
  defaultCharacter,
  TimelineEvent,
  Relationship,
} from "@/lib/types";
import { createId, normalizeCharacterList } from "@/lib/storage";
import { fetchAppData, putCharacters } from "@/lib/apiClient";

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchAppData();
      setCharacters(normalizeCharacterList(data.characters));
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

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      putCharacters(characters)
        .then(() => setSyncError(null))
        .catch((e) =>
          setSyncError(e instanceof Error ? e.message : "保存失败")
        );
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [characters, loaded]);

  const addCharacter = useCallback((partial?: Partial<Character>) => {
    const now = new Date().toISOString();
    const newChar: Character = {
      id: createId(),
      ...defaultCharacter(),
      ...partial,
      createdAt: now,
      updatedAt: now,
    };
    setCharacters((prev) => [...prev, newChar]);
    return newChar.id;
  }, []);

  const updateCharacter = useCallback(
    (id: string, updates: Partial<Character>) => {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, ...updates, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    []
  );

  const deleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const getCharacter = useCallback(
    (id: string) => characters.find((c) => c.id === id),
    [characters]
  );

  const addTimelineEvent = useCallback(
    (charId: string, event: Omit<TimelineEvent, "id">) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          return {
            ...c,
            timeline: [...c.timeline, { ...event, id: createId() }].sort((a, b) =>
              a.date.localeCompare(b.date)
            ),
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const updateTimelineEvent = useCallback(
    (charId: string, eventId: string, updates: Partial<TimelineEvent>) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          return {
            ...c,
            timeline: c.timeline
              .map((e) => (e.id === eventId ? { ...e, ...updates } : e))
              .sort((a, b) => a.date.localeCompare(b.date)),
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const deleteTimelineEvent = useCallback((charId: string, eventId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        return {
          ...c,
          timeline: c.timeline.filter((e) => e.id !== eventId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const addRelationship = useCallback(
    (charId: string, rel: Omit<Relationship, "id">) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          return {
            ...c,
            relationships: [...c.relationships, { ...rel, id: createId() }],
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const updateRelationship = useCallback(
    (charId: string, relId: string, updates: Partial<Relationship>) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          return {
            ...c,
            relationships: c.relationships.map((r) =>
              r.id === relId ? { ...r, ...updates } : r
            ),
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const deleteRelationship = useCallback((charId: string, relId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        return {
          ...c,
          relationships: c.relationships.filter((r) => r.id !== relId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const replaceAll = useCallback((list: Character[]) => {
    setCharacters(normalizeCharacterList(list));
  }, []);

  return {
    characters,
    loaded,
    syncError,
    reload,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    getCharacter,
    addTimelineEvent,
    updateTimelineEvent,
    deleteTimelineEvent,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    replaceAll,
  };
}
