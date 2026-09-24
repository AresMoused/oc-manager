"use client";

import { useState } from "react";
import {
  fetchLoraLibrary,
  fetchLoraTriggerWords,
  loraKey,
  mergeTriggerWords,
  type LoraLibraryItem,
  type SelectedLora,
} from "@/lib/comfyLora";

export default function ComfyLoraPanel({
  baseUrl,
  selected,
  onChange,
  hasLoader,
  hasToggle,
}: {
  baseUrl: string;
  selected: SelectedLora[];
  onChange: (next: SelectedLora[]) => void;
  hasLoader: boolean;
  hasToggle: boolean;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<LoraLibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const inp =
    "w-full bg-[#0c0c0c] border border-neutral-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none text-neutral-200";

  const load = async (nextPage: number, append: boolean) => {
    if (!baseUrl.trim()) {
      setError("先填写 ComfyUI 地址，例如 http://127.0.0.1:8964");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const got = await fetchLoraLibrary(baseUrl, search, nextPage);
      setItems((prev) => (append ? [...prev, ...got.items] : got.items));
      setTotal(got.total);
      setPage(got.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setLoading(false);
    }
  };

  const add = async (item: LoraLibraryItem) => {
    if (selected.some((s) => loraKey(s) === loraKey(item))) return;
    setError("");
    let triggers: SelectedLora["triggers"] = [];
    try {
      const words = await fetchLoraTriggerWords(baseUrl, item.fileName);
      triggers = words.map((text) => ({ text, active: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "触发词读取失败");
    }
    onChange([
      ...selected,
      {
        modelName: item.modelName,
        fileName: item.fileName,
        folder: item.folder,
        strength: 0.6,
        clipStrength: 0.6,
        active: true,
        triggers,
      },
    ]);
  };

  const refreshOne = async (lora: SelectedLora) => {
    setRefreshing(loraKey(lora));
    setError("");
    try {
      const words = await fetchLoraTriggerWords(baseUrl, lora.fileName);
      onChange(
        selected.map((s) =>
          loraKey(s) === loraKey(lora) ? { ...s, triggers: mergeTriggerWords(s.triggers, words) } : s
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "触发词读取失败");
    } finally {
      setRefreshing(null);
    }
  };

  const patch = (key: string, partial: Partial<SelectedLora>) => {
    onChange(selected.map((s) => (loraKey(s) === key ? { ...s, ...partial } : s)));
  };

  return (
    <section className="bg-[#141414] border border-neutral-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-neutral-200">LoRA</h3>
        <span className="text-[10px] text-neutral-600">来自 Lora Manager 库，不是工作流快照</span>
      </div>
      <p className="text-[10px] text-neutral-600 leading-relaxed">
        用上面的 ComfyUI 地址读 <span className="font-mono">/api/lm/loras</span>
        （网页 <span className="font-mono">/loras</span> 只是管理界面）。
        触发词以服务器上的最新缓存为准。关掉的词不会进提示词。
      </p>
      {!hasLoader && (
        <p className="text-[11px] text-amber-300/90">当前工作流没有 Lora Loader (LoraManager)，选择不会生效。</p>
      )}
      {hasLoader && !hasToggle && (
        <p className="text-[11px] text-amber-300/90">没有 TriggerWord Toggle。LoRA 会加载，但关掉的触发词仍会全部送进去。</p>
      )}

      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((lora) => {
            const key = loraKey(lora);
            return (
              <li key={key} className="rounded-lg border border-neutral-800 bg-[#0c0c0c] p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={lora.active}
                    onChange={(e) => patch(key, { active: e.target.checked })}
                    className="mt-1 rounded border-neutral-600"
                    title="启用这张 LoRA"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-neutral-200 truncate">{lora.modelName}</div>
                    <div className="text-[10px] text-neutral-600 font-mono truncate">{lora.fileName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshOne(lora)}
                    disabled={refreshing === key}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800 disabled:opacity-40"
                  >
                    {refreshing === key ? "…" : "刷新词"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(selected.filter((s) => loraKey(s) !== key))}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-rose-900/50 text-rose-400"
                  >
                    移除
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-neutral-500">
                    模型权重
                    <input
                      type="number"
                      min={-2}
                      max={2}
                      step={0.05}
                      className={`${inp} mt-0.5 py-1 font-mono`}
                      value={lora.strength}
                      onChange={(e) => {
                        const strength = Number(e.target.value);
                        patch(key, { strength, clipStrength: lora.clipStrength === lora.strength ? strength : lora.clipStrength });
                      }}
                    />
                  </label>
                  <label className="text-[10px] text-neutral-500">
                    CLIP 权重
                    <input
                      type="number"
                      min={-2}
                      max={2}
                      step={0.05}
                      className={`${inp} mt-0.5 py-1 font-mono`}
                      value={lora.clipStrength}
                      onChange={(e) => patch(key, { clipStrength: Number(e.target.value) })}
                    />
                  </label>
                </div>
                {lora.triggers.length === 0 ? (
                  <p className="text-[10px] text-neutral-600">这张 LoRA 没有触发词。</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {lora.triggers.map((t, i) => (
                      <button
                        key={`${t.text}-${i}`}
                        type="button"
                        onClick={() =>
                          patch(key, {
                            triggers: lora.triggers.map((x, j) => (j === i ? { ...x, active: !x.active } : x)),
                          })
                        }
                        className={`text-[10px] px-1.5 py-0.5 rounded border max-w-full truncate ${
                          t.active
                            ? "border-purple-700/60 text-purple-200 bg-purple-950/40"
                            : "border-neutral-800 text-neutral-600 line-through"
                        }`}
                        title={t.text}
                      >
                        {t.text}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          className={inp}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(1, false);
          }}
          placeholder="搜索 LoRA 名字"
        />
        <button
          type="button"
          onClick={() => void load(1, false)}
          disabled={loading}
          className="px-3 text-xs rounded-lg border border-purple-700/60 text-purple-300 hover:bg-purple-950/30 disabled:opacity-40 whitespace-nowrap"
        >
          {loading ? "读取中…" : "读取库"}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-400 break-all">{error}</p>}
      {items.length > 0 && (
        <ul className="max-h-64 overflow-y-auto divide-y divide-neutral-800 border border-neutral-800 rounded-lg">
          {items.map((item) => {
            const added = selected.some((s) => loraKey(s) === loraKey(item));
            return (
              <li key={loraKey(item)} className="flex items-center gap-2 px-2 py-1.5">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="w-8 h-8 rounded object-cover bg-neutral-900 shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded bg-neutral-900 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-neutral-200 truncate">{item.modelName}</div>
                  <div className="text-[10px] text-neutral-600 truncate">
                    {item.baseModel || item.folder || item.fileName}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => void add(item)}
                  className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 disabled:opacity-40"
                >
                  {added ? "已加" : "加入"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && items.length < total && (
        <button
          type="button"
          onClick={() => void load(page + 1, true)}
          disabled={loading}
          className="text-[11px] text-neutral-400 hover:text-white"
        >
          再加载（{items.length}/{total}）
        </button>
      )}
    </section>
  );
}
