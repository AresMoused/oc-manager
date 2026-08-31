"use client";

import { useRef, useState } from "react";
import {
  allPacks,
  loadContextPacks,
  loadRequestTypes,
  parseContextPacks,
  saveContextPacks,
  saveRequestTypes,
  type RequestType,
} from "@/lib/contextPacks";

export default function RequestTypesPanel({ onPing }: { onPing?: (m: string) => void }) {
  const [types, setTypes] = useState<RequestType[]>(() => loadRequestTypes());
  const [packs, setPacks] = useState(() => allPacks());
  const fileRef = useRef<HTMLInputElement>(null);

  const persistTypes = (next: RequestType[]) => {
    setTypes(next);
    saveRequestTypes(next);
  };
  const refreshPacks = () => setPacks(allPacks());

  return (
    <div className="space-y-3 text-xs">
      <p className="text-neutral-500">
        和智绘姬一样：每种请求绑一套上下文预设。出图每次先用「角色/服装展示」或「正文图片生成」让陪玩姬写提示词，再交给抽卡姬。
      </p>
      <div className="flex gap-2">
        <button type="button" className="px-2 py-1 rounded-lg border border-sky-800 text-sky-300" onClick={() => fileRef.current?.click()}>
          导入上下文预设
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const incoming = parseContextPacks(await f.text());
              const next = [...loadContextPacks(), ...incoming];
              saveContextPacks(next);
              refreshPacks();
              onPing?.(`已导入 ${incoming.map((p) => p.name).join("、")}`);
            } catch (err) {
              onPing?.(err instanceof Error ? err.message : "导入失败");
            }
          }}
        />
      </div>
      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="border border-neutral-800 rounded-xl px-2 py-2">
            <div className="text-neutral-100">{t.name}</div>
            <div className="text-neutral-500 mb-1">{t.blurb}</div>
            {t.id === "assistant" ? (
              <div className="text-neutral-400">使用「人设」页的陪玩姬稿</div>
            ) : (
              <label className="block text-neutral-400">
                上下文预设
                <select
                  className="mt-0.5 w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-200"
                  value={t.packId}
                  onChange={(e) =>
                    persistTypes(types.map((x) => (x.id === t.id ? { ...x, packId: e.target.value } : x)))
                  }
                >
                  <option value="">（不使用）</option>
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.entries.length} 条
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
      </div>
      {loadContextPacks().length > 0 && (
        <div className="space-y-1">
          <div className="text-neutral-400">已导入的包</div>
          {loadContextPacks().map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-neutral-300">
              <span className="flex-1 truncate">{p.name}</span>
              <button
                type="button"
                className="text-rose-400"
                onClick={() => {
                  saveContextPacks(loadContextPacks().filter((x) => x.id !== p.id));
                  persistTypes(types.map((t) => (t.packId === p.id ? { ...t, packId: "" } : t)));
                  refreshPacks();
                }}
              >
                删
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}