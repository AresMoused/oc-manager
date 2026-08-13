"use client";

import {
  BipolarSliderItem,
  BipolarDotItem,
  DotItem,
} from "@/lib/types";
import TraitSlider from "./TraitSlider";
import DotRating from "./DotRating";

export function TraitsList({
  items,
  editable,
  onChange,
}: {
  items: BipolarSliderItem[];
  editable: boolean;
  onChange: (next: BipolarSliderItem[]) => void;
}) {
  const update = (id: string, patch: Partial<BipolarSliderItem>) =>
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="p-3 space-y-2.5">
      {items.map((item) => (
        <div key={item.id} className="group relative">
          {editable && (
            <div className="flex items-center gap-1 mb-0.5">
              <input
                className="w-12 bg-transparent text-emerald-400 text-[10px] text-right outline-none"
                value={item.leftLabel}
                onChange={(e) => update(item.id, { leftLabel: e.target.value })}
              />
              <div className="flex-1" />
              <input
                className="w-12 bg-transparent text-pink-400 text-[10px] outline-none"
                value={item.rightLabel}
                onChange={(e) => update(item.id, { rightLabel: e.target.value })}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                className="text-neutral-600 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 px-0.5"
              >
                ×
              </button>
            </div>
          )}
          <TraitSlider
            leftLabel={editable ? "" : item.leftLabel}
            rightLabel={editable ? "" : item.rightLabel}
            value={item.value}
            onChange={editable ? (v) => update(item.id, { value: v }) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function EmotionsList({
  items,
  editable,
  onChange,
}: {
  items: BipolarDotItem[];
  editable: boolean;
  onChange: (next: BipolarDotItem[]) => void;
}) {
  const update = (id: string, patch: Partial<BipolarDotItem>) =>
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="p-3 space-y-2 text-xs">
      {items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2">
          {editable ? (
            <input
              className="w-10 bg-transparent text-right text-neutral-400 outline-none"
              value={item.leftLabel}
              onChange={(e) => update(item.id, { leftLabel: e.target.value })}
            />
          ) : (
            <span className="w-8 text-right text-neutral-400">{item.leftLabel}</span>
          )}
          <DotRating
            value={item.value}
            onChange={editable ? (v) => update(item.id, { value: v }) : undefined}
          />
          {editable ? (
            <input
              className="w-10 bg-transparent text-neutral-500 outline-none"
              value={item.rightLabel}
              onChange={(e) => update(item.id, { rightLabel: e.target.value })}
            />
          ) : (
            <span className="w-8 text-neutral-500">{item.rightLabel}</span>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              className="text-neutral-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DotItemsList({
  items,
  editable,
  onChange,
}: {
  items: DotItem[];
  editable: boolean;
  onChange: (next: DotItem[]) => void;
}) {
  const update = (id: string, patch: Partial<DotItem>) =>
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="p-3 space-y-2.5 text-xs">
      {items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2">
          {editable ? (
            <input
              className="w-10 bg-transparent text-neutral-400 outline-none"
              value={item.label}
              onChange={(e) => update(item.id, { label: e.target.value })}
            />
          ) : (
            <span className="w-8 text-neutral-400">{item.label}</span>
          )}
          <DotRating
            value={item.value}
            onChange={editable ? (v) => update(item.id, { value: v }) : undefined}
          />
          {editable && (
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              className="text-neutral-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function addBtn(onClick: () => void) {
  return (
    <button
      type="button"
      title="添加"
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 text-white text-xs"
    >
      +
    </button>
  );
}
