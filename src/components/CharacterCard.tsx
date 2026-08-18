"use client";

import Link from "next/link";
import { Character } from "@/lib/types";

interface Props {
  character: Character;
  onDelete?: (id: string) => void;
  accentColor?: string;
  /** Override default /character/:id link (e.g. shared world paths) */
  href?: string;
}

export default function CharacterCard({
  character: c,
  onDelete,
  accentColor,
  href,
}: Props) {
  return (
    <Link
      href={href || `/character/${c.id}`}
      className="group block bg-[#111] border border-neutral-800 rounded-xl overflow-hidden transition-all hover:shadow-lg"
      onMouseEnter={(e) => {
        if (accentColor) e.currentTarget.style.borderColor = accentColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
      }}
    >
      <div className="aspect-[3/4] relative bg-neutral-900 overflow-hidden">
        {c.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.avatar}
            alt={c.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-neutral-700">
            {c.name?.[0] || "?"}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-12">
          <h3 className="font-semibold text-white text-sm truncate">{c.name}</h3>
          <p className="text-xs text-neutral-400 truncate">
            {[c.race, c.identity].filter(Boolean).join(" · ")}
          </p>
          {c.world && (
            <p
              className="text-[10px] mt-0.5 truncate"
              style={{ color: accentColor || "#a78bfa" }}
            >
              {c.world}
            </p>
          )}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {c.gender || "?"} · {c.age || "?"}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (confirm(`Delete ${c.name}?`)) onDelete(c.id);
            }}
            className="text-rose-500/80 hover:text-rose-400"
          >
            Delete
          </button>
        )}
      </div>
    </Link>
  );
}
