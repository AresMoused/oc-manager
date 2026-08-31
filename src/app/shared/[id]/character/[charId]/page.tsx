"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CharacterSheet from "@/components/CharacterSheet";
import Timeline from "@/components/Timeline";
import RelationshipsPanel from "@/components/RelationshipsPanel";
import Gallery from "@/components/Gallery";
import PromptBank from "@/components/PromptBank";
import CharacterChatDock from "@/components/CharacterChatDock";
import type { Character, GalleryImage, StoredPrompt } from "@/lib/types";
import { CheckHost } from "@/systems/check/CheckHost";
import DndRuleSheet from "@/systems/dnd5e/DndRuleSheet";
import { defaultDndPlay, wrapPlay } from "@/systems/dnd5e/schema";

interface ShareMeta {
  id: string;
  ownerName: string;
  ownerAvatarUrl: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  permission: string;
  canEdit: boolean;
  isOwner: boolean;
}

type Tab = "sheet" | "timeline" | "relations" | "gallery" | "prompts" | "rules";

export default function SharedCharacterPage({
  params,
}: {
  params: Promise<{ id: string; charId: string }>;
}) {
  const { id: shareId, charId } = use(params);
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("sheet");
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charsRef = useRef<Character[]>([]);

  useEffect(() => {
    charsRef.current = characters;
  }, [characters]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/shares/${shareId}/content`)
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "加载失败");
        }
        return r.json();
      })
      .then((d) => {
        setShare(d.share);
        setCharacters(d.characters || []);
        setEditMode(false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [shareId]);

  useEffect(() => {
    load();
  }, [load]);

  const character = characters.find((c) => c.id === charId) || null;
  const canEdit = !!share?.canEdit;
  const editable = canEdit && editMode;

  const persistCharacters = useCallback(
    async (nextList: Character[]) => {
      if (!canEdit) return;
      setSaving(true);
      setSaveError("");
      try {
        const res = await fetch(`/api/shares/${shareId}/content`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: nextList }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || `保存失败 (${res.status})`);
        }
        const d = await res.json();
        if (Array.isArray(d.characters)) setCharacters(d.characters);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [shareId, canEdit]
  );

  const patchCharacter = useCallback(
    (updater: (c: Character) => Character) => {
      if (!canEdit) return;
      const nextList = charsRef.current.map((c) =>
        c.id === charId
          ? { ...updater(c), updatedAt: new Date().toISOString() }
          : c
      );
      setCharacters(nextList);
      charsRef.current = nextList;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistCharacters(charsRef.current);
      }, 600);
    },
    [canEdit, charId, persistCharacters]
  );

  const updateCharacter = useCallback(
    (updates: Partial<Character>) => {
      patchCharacter((c) => ({ ...c, ...updates }));
    },
    [patchCharacter]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          Loading...
        </div>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-rose-400">{error || "分享不存在"}</p>
          <Link href="/shared" className="text-purple-400 hover:underline text-sm">
            ← 分享区
          </Link>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar worldColor={share.worldColor} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-neutral-400">角色不存在或不属于此分享世界</p>
          <Link
            href={`/shared/${shareId}`}
            className="text-purple-400 hover:underline text-sm"
          >
            ← {share.worldName}
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "sheet", label: "角色卡" },
    ...(character.play?.system === "dnd5e"
      ? [{ id: "rules" as const, label: "规则卡" }]
      : []),
    { id: "timeline", label: "时间线" },
    { id: "relations", label: "关系" },
    { id: "gallery", label: "图库" },
    { id: "prompts", label: "提示词" },
  ];

  const newId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `id-${Date.now()}`;

  return (
    <CheckHost>
    <div className="min-h-screen flex flex-col">
      <Navbar worldColor={share.worldColor} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/shared/${shareId}`}
              className="text-neutral-400 hover:text-white transition text-sm"
            >
              ← {share.worldName}
            </Link>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: share.worldColor }}
            />
            <h1 className="text-xl font-bold text-white">{character.name}</h1>
            {character.race && (
              <span className="text-xs text-neutral-500 px-2 py-0.5 rounded bg-neutral-800">
                {character.race}
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                canEdit
                  ? "border-emerald-800 text-emerald-300"
                  : "border-neutral-700 text-neutral-500"
              }`}
            >
              {canEdit ? "可修改" : "唯读"}
            </span>
            {saving && (
              <span className="text-[10px] text-neutral-500">保存中…</span>
            )}
            {saveError && (
              <span className="text-[10px] text-rose-400">{saveError}</span>
            )}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`px-3 py-1.5 text-sm border rounded-lg transition ${
                editMode
                  ? "border-amber-700/60 text-amber-300 hover:bg-amber-950/30"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {editMode ? "完成" : "编辑卡面"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-4 border-b border-neutral-800 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                tab === t.id
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sheet" && (
          <CharacterSheet
            character={character}
            onChange={updateCharacter}
            editable={editable}
          />
        )}
        {tab === "rules" && (
          <DndRuleSheet
            character={character}
            editable={editable}
            canWrite={canEdit}
            onChange={(play) =>
              updateCharacter({ play: play || wrapPlay(defaultDndPlay()) })
            }
            onMeta={(p) => updateCharacter(p)}
          />
        )}
        {tab === "timeline" && (
          <Timeline
            events={character.timeline || []}
            editable={editable}
            onAdd={(ev) =>
              patchCharacter((c) => ({
                ...c,
                timeline: [...(c.timeline || []), { ...ev, id: newId() }],
              }))
            }
            onUpdate={(eid, u) =>
              patchCharacter((c) => ({
                ...c,
                timeline: (c.timeline || []).map((t) =>
                  t.id === eid ? { ...t, ...u } : t
                ),
              }))
            }
            onDelete={(eid) =>
              patchCharacter((c) => ({
                ...c,
                timeline: (c.timeline || []).filter((t) => t.id !== eid),
              }))
            }
          />
        )}
        {tab === "relations" && (
          <RelationshipsPanel
            character={character}
            allCharacters={characters}
            editable={editable}
            onAdd={(rel) =>
              patchCharacter((c) => ({
                ...c,
                relationships: [
                  ...(c.relationships || []),
                  { ...rel, id: newId() },
                ],
              }))
            }
            onUpdate={(rid, u) =>
              patchCharacter((c) => ({
                ...c,
                relationships: (c.relationships || []).map((r) =>
                  r.id === rid ? { ...r, ...u } : r
                ),
              }))
            }
            onDelete={(rid) =>
              patchCharacter((c) => ({
                ...c,
                relationships: (c.relationships || []).filter(
                  (r) => r.id !== rid
                ),
              }))
            }
          />
        )}
        {tab === "gallery" && (
          <Gallery
            images={character.gallery || []}
            editable={editable}
            onChange={(images: GalleryImage[]) =>
              updateCharacter({ gallery: images })
            }
          />
        )}
        {tab === "prompts" && (
          <PromptBank
            prompts={character.prompts || []}
            editable={editable}
            onChange={(prompts: StoredPrompt[]) =>
              updateCharacter({ prompts })
            }
          />
        )}
      </main>
      <Footer />
      {character && (
        <CharacterChatDock
          host={character}
          characters={characters}
          localOnly
          canEditCard={canEdit}
          sessionKey={`share:${shareId}:${charId}`}
          onWriteTimeline={() => {}}
          onPatchCharacter={(cid, patch) => {
            if (!canEdit) return;
            if (cid === character.id) updateCharacter(patch);
          }}
        />
      )}
    </div>
    </CheckHost>
  );
}
