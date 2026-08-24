"use client";

import { useMemo, useState } from "react";

export type AdvMode = "none" | "adv" | "dis";

export interface ExtraDie {
  count: number;
  faces: number;
}

export interface CheckRequest {
  title: string;
  baseBonus: number;
  breakdown?: string;
  kind?: "check" | "save" | "attack" | "damage" | "free" | "death" | "initiative";
  dcLabel?: string;
  defaultDc?: number;
  presetAdv?: AdvMode;
  damageCount?: number;
  damageFaces?: number;
  damageBonus?: number;
  ability?: string;
  skillId?: string;
  warnings?: string[];
  autoFail?: boolean;
  d20Penalty?: number;
}

const FACE_OPTS = [4, 6, 8, 10, 12, 20, 100];

function rollDie(faces: number) {
  return 1 + Math.floor(Math.random() * faces);
}

function rollDice(count: number, faces: number) {
  const facesN = Math.max(2, faces);
  const n = Math.max(1, count);
  const rolls = Array.from({ length: n }, () => rollDie(facesN));
  return { rolls, sum: rolls.reduce((a, b) => a + b, 0) };
}

export default function CheckPanel({
  req,
  onClose,
}: {
  req: CheckRequest;
  onClose: () => void;
}) {
  const kind = req.kind || "check";
  const isDamage = kind === "damage";
  const isFree = kind === "free";
  const [adv, setAdv] = useState<AdvMode>(req.presetAdv || "none");
  const [flat, setFlat] = useState(0);
  const [dc, setDc] = useState(
    req.defaultDc != null ? String(req.defaultDc) : ""
  );
  const [extra, setExtra] = useState<ExtraDie[]>([]);
  const [manual, setManual] = useState("");
  const [manualExtras, setManualExtras] = useState<Record<number, string>>({});
  const [result, setResult] = useState<string[] | null>(null);

  const dcNum = dc.trim() === "" ? null : Number(dc);

  const addExtra = () => setExtra((p) => [...p, { count: 1, faces: 6 }]);

  const resolve = (mode: "auto" | "manual") => {
    const lines: string[] = [];
    let total = 0;

    if (isDamage) {
      const c = req.damageCount || 1;
      const f = req.damageFaces || 6;
      const rolled = rollDice(c, f);
      lines.push(`伤害骰 ${c}d${f}：${rolled.rolls.join(" + ")} = ${rolled.sum}`);
      total += rolled.sum + (req.damageBonus || 0) + (Number(flat) || 0);
      lines.push(`伤害加值 ${req.damageBonus || 0}，额外 ${flat || 0}`);
    } else if (!isFree) {
      let d20 = 0;
      if (mode === "manual") {
        d20 = Math.max(1, Math.min(20, Number(manual) || 1));
        lines.push(`手填 d20：${d20}${adv !== "none" ? "（已取过优劣）" : ""}`);
      } else if (adv === "adv" || adv === "dis") {
        const a = rollDie(20);
        const b = rollDie(20);
        d20 = adv === "adv" ? Math.max(a, b) : Math.min(a, b);
        lines.push(`${adv === "adv" ? "优势" : "劣势"}：${a} 与 ${b} → ${d20}`);
      } else {
        d20 = rollDie(20);
        lines.push(`d20：${d20}`);
      }
      if (d20 === 20) lines.push("★ 大成功");
      if (d20 === 1) lines.push("★ 大失败");
      if (kind === "death") {
        if (d20 === 20) lines.push("死亡豁免：自然 20 → 清醒且 1 HP");
        if (d20 === 1) lines.push("死亡豁免：自然 1 → 两次失败");
      }
      total += d20 + (Number(req.baseBonus) || 0) + (Number(flat) || 0);
      lines.push(`基础加值 ${req.baseBonus >= 0 ? "+" : ""}${req.baseBonus}`);
      if (flat) lines.push(`额外加值 ${flat >= 0 ? "+" : ""}${flat}`);
      const penalty = Number(req.d20Penalty) || 0;
      if (penalty) {
        total -= penalty;
        lines.push(`状态：d20 −${penalty}`);
      }
    }

    extra.forEach((die, i) => {
      const hand = manualExtras[i];
      if (mode === "manual" && hand != null && hand !== "") {
        const n = Number(hand) || 0;
        total += n;
        lines.push(`额外 ${die.count}d${die.faces} 手填：${n}`);
      } else {
        const rolled = rollDice(die.count, die.faces);
        total += rolled.sum;
        lines.push(
          `额外 ${die.count}d${die.faces}：${rolled.rolls.join(" + ")} = ${rolled.sum}`
        );
      }
    });

    lines.push(`总计：${total}`);
    if (req.autoFail) lines.push("⚠ 规则上此检定自动失败");
    if (!isDamage && !isFree && dcNum != null && !Number.isNaN(dcNum)) {
      lines.push(
        `${req.dcLabel || "DC"} ${dcNum} → ${total >= dcNum ? "通过" : "未通过"}`
      );
    }
    setResult(lines);
  };

  const title = useMemo(() => req.title, [req.title]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#121212] border border-cyan-700/50 rounded-xl p-4 space-y-3 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">{title}</h3>
            {req.breakdown && (
              <p className="text-[11px] text-neutral-500 mt-0.5">{req.breakdown}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-sm"
          >
            关闭
          </button>
        </div>

        {(!!req.warnings?.length || req.autoFail || !!req.d20Penalty) && (
          <div className="text-xs bg-amber-950/40 border border-amber-700/50 rounded-lg p-2 space-y-1 text-amber-100">
            <p className="text-amber-300 font-medium">状态警告</p>
            {req.autoFail && (
              <p className="text-rose-300 font-semibold">规则上此检定自动失败</p>
            )}
            {!!req.d20Penalty && (
              <p>已计入 d20 −{req.d20Penalty}</p>
            )}
            {(req.warnings || []).map((w, i) => (
              <p key={i}>· {w}</p>
            ))}
          </div>
        )}

        {!isDamage && !isFree && (
          <div className="flex gap-2 text-xs">
            {(
              [
                ["none", "正常"],
                ["adv", "优势"],
                ["dis", "劣势"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAdv(k)}
                className={`px-3 py-1 rounded-lg border ${
                  adv === k
                    ? "border-cyan-400 text-cyan-200 bg-cyan-950/50"
                    : "border-neutral-700 text-neutral-400"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="space-y-1">
            <span className="text-[11px] text-neutral-500">额外加值</span>
            <input
              type="number"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200"
              value={flat}
              onChange={(e) => setFlat(Number(e.target.value) || 0)}
            />
          </label>
          {!isDamage && !isFree && (
            <label className="space-y-1">
              <span className="text-[11px] text-neutral-500">
                {req.dcLabel || "DC"}（可空）
              </span>
              <input
                inputMode="numeric"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200"
                value={dc}
                onChange={(e) => setDc(e.target.value)}
                placeholder="不判通过"
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">额外骰 [数量]D[面]</span>
            <button
              type="button"
              onClick={addExtra}
              className="text-xs text-cyan-300 hover:text-white"
            >
              + 加骰
            </button>
          </div>
          {extra.map((die, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
                value={die.count}
                onChange={(e) =>
                  setExtra((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, count: Number(e.target.value) || 1 } : x
                    )
                  )
                }
              />
              <span className="text-neutral-500 text-xs">D</span>
              <select
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
                value={die.faces}
                onChange={(e) =>
                  setExtra((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, faces: Number(e.target.value) } : x
                    )
                  )
                }
              >
                {FACE_OPTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400"
                placeholder="手填此骰合计（可空）"
                value={manualExtras[i] ?? ""}
                onChange={(e) =>
                  setManualExtras((p) => ({ ...p, [i]: e.target.value }))
                }
              />
              <button
                type="button"
                className="text-neutral-500 text-xs"
                onClick={() => setExtra((p) => p.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {!isDamage && !isFree && (
          <label className="block space-y-1">
            <span className="text-[11px] text-neutral-500">
              手填 d20（已经取过的那颗）
            </span>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="留空则用马上判定"
            />
          </label>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => resolve("auto")}
            className="flex-1 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium"
          >
            马上判定
          </button>
          {!isFree && (
            <button
              type="button"
              onClick={() => resolve("manual")}
              className="flex-1 py-2 rounded-lg border border-cyan-700 text-cyan-200 text-sm"
            >
              填入手骰
            </button>
          )}
        </div>

        {result && (
          <div className="text-sm bg-black/40 border border-neutral-800 rounded-lg p-3 space-y-1 text-neutral-200 font-mono">
            {result.map((l, i) => (
              <p key={i} className={l.startsWith("★") ? "text-amber-300" : ""}>
                {l}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
