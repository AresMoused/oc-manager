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
    async (
      nameOrPartial?: string | Partial<Character>,
      worldName?: string
    ) => {
      const partial: Partial<Character> =
        typeof nameOrPartial === "string"
          ? { name: nameOrPartial, world: worldName || "" }
          : nameOrPartial || {};
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
      const next = characters
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          relationships: c.relationships.filter((r) => r.targetId !== id),
        }));
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

  /** Add relationship on both characters (A↔B stay in sync) */
  const addRelationship = useCallback(
    (charId: string, rel: Omit<Relationship, "id">) => {
      const targetId = rel.targetId;
      if (!targetId || targetId === charId) return;
      const now = new Date().toISOString();
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id === charId) {
            const existing = c.relationships.find((r) => r.targetId === targetId);
            if (existing) {
              return {
                ...c,
                relationships: c.relationships.map((r) =>
                  r.targetId === targetId
                    ? {
                        ...r,
                        type: rel.type,
                        strength: rel.strength,
                        note: rel.note,
                      }
                    : r
                ),
                updatedAt: now,
              };
            }
            return {
              ...c,
              relationships: [...c.relationships, { ...rel, id: createId() }],
              updatedAt: now,
            };
          }
          if (c.id === targetId) {
            const existing = c.relationships.find((r) => r.targetId === charId);
            if (existing) {
              return {
                ...c,
                relationships: c.relationships.map((r) =>
                  r.targetId === charId
                    ? {
                        ...r,
                        type: rel.type,
                        strength: rel.strength,
                        note: rel.note,
                      }
                    : r
                ),
                updatedAt: now,
              };
            }
            return {
              ...c,
              relationships: [
                ...c.relationships,
                {
                  id: createId(),
                  targetId: charId,
                  type: rel.type,
                  strength: rel.strength,
                  note: rel.note,
                },
              ],
              updatedAt: now,
            };
          }
          return c;
        })
      );
    },
    [setCharacters]
  );

  /** Update relationship on both sides of the pair */
  const updateRelationship = useCallback(
    (charId: string, relId: string, updates: Partial<Relationship>) => {
      const now = new Date().toISOString();
      setCharacters((prev) => {
        const source = prev.find((c) => c.id === charId);
        const rel = source?.relationships.find((r) => r.id === relId);
        if (!source || !rel) return prev;
        const targetId = updates.targetId ?? rel.targetId;
        const nextType = updates.type ?? rel.type;
        const nextStrength =
          updates.strength !== undefined ? updates.strength : rel.strength;
        const nextNote = updates.note !== undefined ? updates.note : rel.note;

        return prev.map((c) => {
          if (c.id === charId) {
            return {
              ...c,
              relationships: c.relationships.map((r) =>
                r.id === relId
                  ? {
                      ...r,
                      ...updates,
                      targetId,
                    }
                  : r
              ),
              updatedAt: now,
            };
          }
          if (c.id === rel.targetId || c.id === targetId) {
            return {
              ...c,
              relationships: c.relationships.map((r) =>
                r.targetId === charId
                  ? {
                      ...r,
                      type: nextType,
                      strength: nextStrength,
                      note: nextNote,
                    }
                  : r
              ),
              updatedAt: now,
            };
          }
          return c;
        });
      });
    },
    [setCharacters]
  );

  /** Delete relationship from both characters */
  const deleteRelationship = useCallback(
    (charId: string, relId: string) => {
      const now = new Date().toISOString();
      setCharacters((prev) => {
        const source = prev.find((c) => c.id === charId);
        const rel = source?.relationships.find((r) => r.id === relId);
        const targetId = rel?.targetId;
        return prev.map((c) => {
          if (c.id === charId) {
            return {
              ...c,
              relationships: c.relationships.filter((r) => r.id !== relId),
              updatedAt: now,
            };
          }
          if (targetId && c.id === targetId) {
            return {
              ...c,
              relationships: c.relationships.filter(
                (r) => r.targetId !== charId
              ),
              updatedAt: now,
            };
          }
          return c;
        });
      });
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
