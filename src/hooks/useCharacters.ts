"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Character,
  defaultCharacter,
  TimelineEvent,
  Relationship,
} from "@/lib/types";
import {
  loadCharacters,
  saveCharacters,
  createId,
} from "@/lib/storage";

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCharacters(loadCharacters());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveCharacters(characters);
    }
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
            timeline: [
              ...c.timeline,
              { ...event, id: createId() },
            ].sort((a, b) => a.date.localeCompare(b.date)),
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
            timeline: c.timeline.map((e) =>
              e.id === eventId ? { ...e, ...updates } : e
            ),
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
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
    []
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
    []
  );

  const replaceAll = useCallback((chars: Character[]) => {
    setCharacters(chars);
  }, []);

  return {
    characters,
    loaded,
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
