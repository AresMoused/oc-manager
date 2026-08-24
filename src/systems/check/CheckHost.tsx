"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import CheckPanel, { type CheckRequest } from "./CheckPanel";

const Ctx = createContext<(req: CheckRequest) => void>(() => {});

export function useOpenCheck() {
  return useContext(Ctx);
}

export function CheckHost({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<CheckRequest | null>(null);
  const open = useCallback((r: CheckRequest) => setReq(r), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {req && <CheckPanel req={req} onClose={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

export function FreeDiceButton({ className = "" }: { className?: string }) {
  const open = useOpenCheck();
  return (
    <button
      type="button"
      onClick={() => open({ title: "自由骰", baseBonus: 0, kind: "free" })}
      className={`px-3 py-1.5 text-sm rounded-lg border border-cyan-700/70 text-cyan-200 hover:bg-cyan-950/40 ${className}`}
    >
      骰子
    </button>
  );
}
