"use client";

import { useMemo, useState } from "react";
import type { AppearanceProfile, OutfitPreset, StoredPrompt, ViewLayer } from "@/lib/types";
import {
  appearanceSummary,
  composeAppearancePrompt,
  importZhiCharacterJson,
  normalizeAppearance,
} from "@/lib/appearance";
import SectionHeader from "./SectionHeader";

interface Props {
  prompts: StoredPrompt[];
  onChange: (prompts: StoredPrompt[]) => void;
  appearance?: AppearanceProfile;
  onAppearanceChange?: (a: AppearanceProfile) => void;
  characterName?: string;
  editable?: boolean;
}

export default function PromptBank({
  prompts,
  onChange,
  appearance,
  onAppearanceChange,
  characterName,
  editable = true,
}: Props) {
  const [tab, setTab] = useState<"look" | "outfit" | "snap">("look");
  const [draft, setDraft] = useState("");
  const [label, setLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const app = normalizeAppearance(appearance);
  const canLook = !!onAppearanceChange;

  const ping = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 1600);
  };

  const setApp = (next: AppearanceProfile) => onAppearanceChange?.(next);

  const preview = useMemo(
    () => composeAppearancePrompt(app, { extra: "" }),
    [app]
  );

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([
      ...prompts,
      {
        id: crypto.randomUUID(),
        text,
        label: label.trim() || "提示词",
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setLabel("");
    setShowForm(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      ping("已复制");
    } catch {
      ping("复制失败");
    }
  };

  const importFile = async (file: File) => {
    try {
      const { appearance: next, importedName } = importZhiCharacterJson(
        await file.text(),
        characterName
      );
      setApp(next);
      ping(`已导入 ${importedName} 的外观/服装（不含参考图）`);
      setTab("look");
    } catch (e) {
      ping(e instanceof Error ? e.message : "导入失败");
    }
  };

  return (
    <div className="mb-4">
      <SectionHeader
        title="外观 / 提示词"
        onAdd={editable && tab === "snap" ? () => setShowForm(true) : undefined}
      />
      <div className="bg-[#111] border border-neutral-800 border-t-0 rounded-b-md">
        <div className="flex text-[11px] border-b border-neutral-800">
          {([
            ["look", "外观"],
            ["outfit", "服装"],
            ["snap", "快照"],
          ] as const).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              className={`px-3 py-2 ${tab === k ? "text-purple-300 border-b-2 border-purple-500" : "text-neutral-500"}`}
              onClick={() => setTab(k)}
            >
              {lab}
            </button>
          ))}
          {editable && canLook && (
            <label className="ml-auto px-3 py-2 text-sky-400 cursor-pointer">
              导入智绘姬角色
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importFile(f);
                }}
              />
            </label>
          )}
        </div>
        <div className="p-3 space-y-2">
          {tab === "look" && canLook && (
            <>
              <p className="text-[11px] text-neutral-500">
                和智绘姬一样：脸/上身/下身与服装分开。陪玩姬生图会按当前服装组合。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="中文名" value={app.nameCN} disabled={!editable} onChange={(v) => setApp({ ...app, nameCN: v })} />
                <Field label="英文名" value={app.nameEN} disabled={!editable} onChange={(v) => setApp({ ...app, nameEN: v })} />
              </div>
              <LayerEd title="五官 / 脸" layer={app.face} editable={editable} onChange={(face) => setApp({ ...app, face })} />
              <LayerEd title="上身 SFW" layer={app.upperSfw} editable={editable} onChange={(upperSfw) => setApp({ ...app, upperSfw })} />
              <LayerEd title="全身/下身 SFW" layer={app.fullSfw} editable={editable} onChange={(fullSfw) => setApp({ ...app, fullSfw })} />
              <LayerEd title="上身 NSFW" layer={app.upperNsfw} editable={editable} onChange={(upperNsfw) => setApp({ ...app, upperNsfw })} />
              <LayerEd title="全身/下身 NSFW" layer={app.fullNsfw} editable={editable} onChange={(fullNsfw) => setApp({ ...app, fullNsfw })} />
              <label className="block text-[11px] text-neutral-500">
                出图底词（photoPrompt）
                <textarea
                  className="mt-1 w-full min-h-[56px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono text-[11px] text-neutral-200"
                  disabled={!editable}
                  value={app.photoPrompt}
                  onChange={(e) => setApp({ ...app, photoPrompt: e.target.value })}
                />
              </label>
            </>
          )}
          {tab === "outfit" && canLook && (
            <>
              <div className="flex flex-wrap gap-1">
                {app.outfits.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`px-2 py-0.5 rounded-full text-[11px] border ${app.activeOutfitId === o.id ? "border-purple-500 text-purple-200 bg-purple-950/50" : "border-neutral-700 text-neutral-400"}`}
                    onClick={() => setApp({ ...app, activeOutfitId: o.id })}
                  >
                    {o.nameCN || o.nameEN}
                  </button>
                ))}
                {editable && (
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full text-[11px] border border-sky-800 text-sky-300"
                    onClick={() => {
                      const o: OutfitPreset = {
                        id: crypto.randomUUID(),
                        nameCN: "新服装",
                        nameEN: "",
                        upper: { front: "", back: "" },
                        full: { front: "", back: "" },
                        photoPrompt: "",
                      };
                      setApp({ ...app, outfits: [...app.outfits, o], activeOutfitId: o.id });
                    }}
                  >
                    + 服装
                  </button>
                )}
              </div>
              {app.outfits.filter((o) => o.id === app.activeOutfitId).map((o) => (
                <div key={o.id} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="中文" value={o.nameCN} disabled={!editable} onChange={(v) => setApp({ ...app, outfits: app.outfits.map((x) => x.id === o.id ? { ...x, nameCN: v } : x) })} />
                    <Field label="英文" value={o.nameEN} disabled={!editable} onChange={(v) => setApp({ ...app, outfits: app.outfits.map((x) => x.id === o.id ? { ...x, nameEN: v } : x) })} />
                  </div>
                  <LayerEd title="上身" layer={o.upper} editable={editable} onChange={(upper) => setApp({ ...app, outfits: app.outfits.map((x) => x.id === o.id ? { ...x, upper } : x) })} />
                  <LayerEd title="下身/全身" layer={o.full} editable={editable} onChange={(full) => setApp({ ...app, outfits: app.outfits.map((x) => x.id === o.id ? { ...x, full } : x) })} />
                  {editable && (
                    <button
                      type="button"
                      className="text-[11px] text-rose-400"
                      onClick={() =>
                        setApp({
                          ...app,
                          outfits: app.outfits.filter((x) => x.id !== o.id),
                          activeOutfitId: app.outfits.find((x) => x.id !== o.id)?.id || "",
                        })
                      }
                    >
                      删除这套服装
                    </button>
                  )}
                </div>
              ))}
              {!app.outfits.length && <p className="text-neutral-600 text-sm text-center py-4">还没有服装，可导入智绘姬角色 JSON 或手动添加</p>}
            </>
          )}
          {(tab === "look" || tab === "outfit") && canLook && (
            <div className="border border-neutral-800 rounded-lg p-2">
              <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                <span>当前组合预览</span>
                <button type="button" className="text-purple-300" onClick={() => void copy(preview)}>复制</button>
              </div>
              <p className="font-mono text-[11px] text-neutral-400 break-all">{preview || "（空）"}</p>
            </div>
          )}
          {tab === "snap" && (
            <>
              <p className="text-[11px] text-neutral-500">旧的整段提示词快照，仍可供抽卡姬点选。分层外观请用上面两个页签。</p>
              {showForm && editable && (
                <div className="p-3 bg-[#0a0a0a] border border-purple-800/40 rounded-lg space-y-2 mb-2">
                  <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm" placeholder="标签（可选）" value={label} onChange={(e) => setLabel(e.target.value)} />
                  <textarea className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono min-h-[72px]" placeholder="1girl, blonde hair, ..." value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 text-sm text-neutral-400">取消</button>
                    <button type="button" onClick={add} className="px-3 py-1 text-sm bg-purple-600 rounded text-white">保存</button>
                  </div>
                </div>
              )}
              {prompts.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-4">暂无快照</p>
              ) : (
                prompts.map((p) => (
                  <div key={p.id} className="group relative border border-neutral-800 rounded-lg p-3 bg-[#0c0c0c]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-purple-400 font-medium">{p.label || "提示词"}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => void copy(p.text)} className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400">复制</button>
                        {editable && (
                          <button type="button" onClick={() => onChange(prompts.filter((x) => x.id !== p.id))} className="text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-rose-400/80">删除</button>
                        )}
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-neutral-400 break-all leading-relaxed">{p.text}</p>
                  </div>
                ))
              )}
            </>
          )}
          {!canLook && tab !== "snap" && (
            <p className="text-neutral-600 text-sm">此页只读快照。外观分层请在可编辑角色卡里改。</p>
          )}
          {toast && <p className="text-center text-xs text-emerald-400">{toast}</p>}
          {canLook && tab === "look" && (
            <pre className="hidden">{appearanceSummary(app)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-[11px] text-neutral-500">
      {label}
      <input
        className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LayerEd({
  title,
  layer,
  onChange,
  editable,
}: {
  title: string;
  layer: ViewLayer;
  onChange: (l: ViewLayer) => void;
  editable: boolean;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-2 space-y-1">
      <div className="text-[11px] text-neutral-400">{title}</div>
      <textarea
        className="w-full min-h-[44px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono text-[11px] text-neutral-200"
        placeholder="正面 tags"
        disabled={!editable}
        value={layer.front}
        onChange={(e) => onChange({ ...layer, front: e.target.value })}
      />
      <textarea
        className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono text-[11px] text-neutral-300"
        placeholder="背面 tags（可空，空则用正面）"
        disabled={!editable}
        value={layer.back}
        onChange={(e) => onChange({ ...layer, back: e.target.value })}
      />
    </div>
  );
}