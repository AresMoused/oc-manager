"use client";

interface Props {
  title: string;
  onAdd?: () => void;
  children?: React.ReactNode;
}

export default function SectionHeader({ title, onAdd, children }: Props) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-[#6b21a8] to-[#7c3aed] px-3 py-1.5 rounded-t-md">
      <span className="text-sm font-semibold text-white tracking-wide">
        {title}
      </span>
      <div className="flex items-center gap-2">
        {children}
        {onAdd && (
          <button
            onClick={onAdd}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 text-white text-xs"
            title="Add"
          >
            +
          </button>
        )}
        <button className="w-5 h-5 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-xs opacity-60">
          ⋮
        </button>
      </div>
    </div>
  );
}
