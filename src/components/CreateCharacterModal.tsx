"use client";

import { useState, useEffect } from "react";
import { useWorldCatalog } from "@/hooks/useWorldCatalog";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; world: string }) => void;
  existingWorlds: string[];
  /** Pre-select this world when opening from a folder */
  defaultWorld?: string | null;
}

export default function CreateCharacterModal({
  open,
  onClose,
  onCreate,
  existingWorlds,
  defaultWorld,
}: Props) {
  const { worlds: catalogWorlds, createWorld } = useWorldCatalog();
  const allWorlds = Array.from(
    new Set([...existingWorlds, ...catalogWorlds].filter(Boolean))
  ).sort();

  const initialWorld =
    defaultWorld && defaultWorld !== "__none__" ? defaultWorld : "";

  const [step, setStep] = useState<1 | 2>(initialWorld ? 2 : 1);
  const [world, setWorld] = useState(initialWorld);
  const [newWorld, setNewWorld] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"pick" | "create">(
    initialWorld || allWorlds.length ? "pick" : "create"
  );

  // Reset / prefill whenever modal opens
  useEffect(() => {
    if (!open) return;
    const w = defaultWorld && defaultWorld !== "__none__" ? defaultWorld : "";
    setWorld(w);
    setNewWorld("");
    setName("");
    setMode(w || allWorlds.length ? "pick" : "create");
    setStep(w ? 2 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultWorld]);

  if (!open) return null;

  const selectedWorld = mode === "create" ? newWorld.trim() : world;

  const canNext = step === 1 ? !!selectedWorld : !!name.trim();

  const reset = () => {
    setStep(1);
    setWorld("");
    setNewWorld("");
    setName("");
    setMode(allWorlds.length ? "pick" : "create");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedWorld || !name.trim()) return;
    if (mode === "create" && selectedWorld) {
      createWorld(selectedWorld);
    }
    onCreate({ name: name.trim(), world: selectedWorld });
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">创建角色 / New Character</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Step {step} of 2 · {step === 1 ? "选择世界 / World" : "基本信息 / Name"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-white text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="flex h-1">
          <div className={`flex-1 ${step >= 1 ? "bg-purple-600" : "bg-neutral-800"}`} />
          <div className={`flex-1 ${step >= 2 ? "bg-purple-600" : "bg-neutral-800"}`} />
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-neutral-400">
                角色必须归属一个<strong className="text-neutral-200">世界</strong>。
                数据按世界分区存储与导出。
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("pick")}
                  disabled={!allWorlds.length}
                  className={`flex-1 py-2 text-sm rounded-lg border transition ${
                    mode === "pick"
                      ? "border-purple-500 bg-purple-900/30 text-purple-300"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  } disabled:opacity-40`}
                >
                  选择已有世界
                </button>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`flex-1 py-2 text-sm rounded-lg border transition ${
                    mode === "create"
                      ? "border-purple-500 bg-purple-900/30 text-purple-300"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  创建新世界
                </button>
              </div>

              {mode === "pick" ? (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-neutral-800 p-1">
                  {allWorlds.length === 0 && (
                    <p className="text-xs text-neutral-500 text-center py-4">
                      还没有世界，请先创建
                    </p>
                  )}
                  {allWorlds.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWorld(w)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                        world === w
                          ? "bg-purple-600/40 text-purple-200"
                          : "text-neutral-300 hover:bg-neutral-800"
                      }`}
                    >
                      📁 {w}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  autoFocus
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
                  placeholder="世界名称，例如：绿叶边境 / Cyberpunk 2077"
                  value={newWorld}
                  onChange={(e) => setNewWorld(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canNext) setStep(2);
                  }}
                />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-900/20 border border-purple-800/40 rounded-lg px-3 py-2">
                <span>📁</span>
                <span className="truncate">{selectedWorld}</span>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1.5">角色姓名 / Name</label>
                <input
                  autoFocus
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
                  placeholder="输入角色名..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canNext) handleSubmit();
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-800 flex justify-between gap-2">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              ← 上一步
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              取消
            </button>
          )}
          {step === 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep(2)}
              className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-medium"
            >
              下一步 →
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext}
              onClick={handleSubmit}
              className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-medium"
            >
              创建角色
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
