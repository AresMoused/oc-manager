"use client";

import { useEffect, useState } from "react";
import { fetchAppData, migrateLocalToServer } from "@/lib/apiClient";
import { loadCharacters } from "@/lib/storage";
import { loadWorlds } from "@/lib/worlds";
import { loadWorldCatalog } from "@/lib/worldCatalog";

const FLAG = "oc-manager-migrated-to-server-v1";

export default function ServerSyncBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(FLAG) === "1") {
      setServerOk(true);
      return;
    }
    (async () => {
      try {
        const data = await fetchAppData();
        setServerOk(true);
        const localChars = loadCharacters();
        const localWorlds = loadWorlds();
        const serverEmpty =
          (data.characters?.length || 0) === 0 &&
          (data.worlds?.length || 0) === 0;
        const hasLocal = localChars.length > 0 || localWorlds.length > 0;
        if (serverEmpty && hasLocal) {
          setShow(true);
        } else if (!serverEmpty) {
          localStorage.setItem(FLAG, "1");
        }
      } catch {
        setServerOk(false);
      }
    })();
  }, []);

  const migrate = async () => {
    setBusy(true);
    setMsg("");
    try {
      await migrateLocalToServer({
        characters: loadCharacters(),
        worlds: loadWorlds(),
        catalog: loadWorldCatalog(),
      });
      localStorage.setItem(FLAG, "1");
      setShow(false);
      setMsg("已同步到服务器 · 刷新其他设备即可看到");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "同步失败");
    } finally {
      setBusy(false);
    }
  };

  if (serverOk === false) {
    return (
      <div className="bg-rose-950/40 border-b border-rose-900/50 text-rose-200 text-xs px-4 py-2 text-center">
        无法连接服务器存储（/api/data）。请确认用 npm run dev 或 npm start
        在本机/VPS 运行。
      </div>
    );
  }

  if (!show && !msg) return null;

  return (
    <div className="bg-sky-950/50 border-b border-sky-800/50 text-sky-100 text-sm px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {show ? (
          <>
            <p>
              检测到本浏览器有本地角色数据，服务器尚为空。上传后手机与其他浏览器可共享同一份角色卡与图片链接。
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={migrate}
                className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs disabled:opacity-50"
              >
                {busy ? "上传中…" : "上传到服务器"}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(FLAG, "1");
                  setShow(false);
                }}
                className="px-3 py-1 rounded-lg border border-neutral-600 text-neutral-300 text-xs"
              >
                忽略
              </button>
            </div>
          </>
        ) : (
          <p className="text-center w-full">{msg}</p>
        )}
      </div>
    </div>
  );
}
