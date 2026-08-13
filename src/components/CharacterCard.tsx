"use client";

import Link from "next/link";
import { Character } from "@/lib/types";

interface Props {
  character: Character;
  onDelete?: (id: string) => void;
}

export default function CharacterCard({ character: c, onDelete }: Props) {
  return (
    <Link
      href={`/character/${c.id}`}
      className="group block bg-[#111] border border-neutral-800 rounded-xl overflow-hidden hover:border-purple-600/60 transition-all hover:shadow-lg hover:shadow-purple-900/20"
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
          <div className="w-full h-full flex items-center justify-center text-neutral-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
          <h3 className="font-semibold text-white truncate">{c.name}</h3>
          <p className="text-xs text-neutral-400 truncate">
            {c.race} · {c.identity}
          </p>
          {c.world && (
            <p className="text-[10px] text-purple-400/80 truncate mt-0.5">
              {c.world}
            </p>
          )}
        </div>
      </div>
      <div className="p-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {c.gender} · {c.age}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (confirm(`Delete ${c.name}?`)) onDelete(c.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition"
          >
            Delete
          </button>
        )}
      </div>
    </Link>
  );
}
