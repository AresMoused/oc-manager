"use client";

interface Props {
  leftLabel: string;
  rightLabel: string;
  value: number; // 0-100 (higher = more left)
  onChange?: (v: number) => void;
  readonly?: boolean;
}

export default function TraitSlider({
  leftLabel,
  rightLabel,
  value,
  onChange,
  readonly = false,
}: Props) {
  const leftPercent = value;
  const rightPercent = 100 - value;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-right text-emerald-400 truncate">
        {leftLabel}
      </span>
      <div className="flex-1 relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-pink-400 to-pink-500"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
        {!readonly && (
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        )}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow-md pointer-events-none"
          style={{ left: `calc(${value}% - 7px)` }}
        />
      </div>
      <span className="w-12 text-pink-400 truncate">{rightLabel}</span>
      <span className="w-8 text-right text-neutral-400 tabular-nums">
        {rightPercent}%
      </span>
    </div>
  );
}
