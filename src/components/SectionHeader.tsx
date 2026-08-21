"use client";

import { ReactNode } from "react";

interface Props {
  title: ReactNode;
  onAdd?: () => void;
  children?: ReactNode;
  showKebab?: boolean;
}

export default function SectionHeader({
  title,
  onAdd,
  children,
  showKebab = false,
}: Props) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-[#6b21a8] to-[#7c3aed] px-3 py-1.5 rounded-t-md gap-2">
      <div className="text-sm font-semibold text-white tracking-wide min-w-0 truncate">
        {title}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {children}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 text-white text-xs"
            title="添加"
          >
            +
          </button>
        )}
        {showKebab && (
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-xs opacity-60"
          >
            ⋮
          </button>
        )}
      </div>
    </div>
  );
}
