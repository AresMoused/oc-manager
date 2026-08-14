"use client";

import { useCallback } from "react";
import {
  Character,
  defaultCharacter,
  TimelineEvent,
  Relationship,
} from "@/lib/types";
import { createId, normalizeCharacterList } from "@/lib/storage";
import { useAppData } from "@/context/AppDataContext";

export function useCharacters() {
  const { characters, loaded, syncError, setCharacters, flush, reload } =
    useAppData();

  const addCharacter = useCallback(
    async (partial?: Partial<Character>) => {
      const now = new Date().toISOString();
      const newChar: Character = {
        id: createId(),
        ...defaultCharacter(),
        ...partial,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...characters, newChar];
      await flush({ characters: next });
      return newChar.id;
    },
    [characters, flush]
  );

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
    [setCharacters]
  );

  const deleteCharacter = useCallback(
    async (id: string) => {
      const next = characters.filter((c) => c.id !== id);
      await flush({ characters: next });
    },
    [characters, flush]
  );

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
            timeline: [...c.timeline, { ...event, id: createId() }].sort(
              (a, b) => a.date.localeCompare(b.date)
            ),
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [setCharacters]
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
    [setCharacters]
  );

  const deleteTimelineEvent = useCallback(
    (charId: string, eventId: string) => {
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
    },
    [setCharacters]
  );

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
    [setCharacters]
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
    [setCharacters]
  );

  const deleteRelationship = useCallback(
    (charId: string, relId: string) => {
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
    },
    [setCharacters]
  );

  const replaceAll = useCallback(
    async (list: Character[]) => {
      await flush({ characters: normalizeCharacterList(list) });
    },
    [flush]
  );

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
