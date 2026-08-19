"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GeneratorAdminPanel from "@/components/GeneratorAdminPanel";
import type { BuilderSection } from "@/lib/promptBuilder";
import { loadParams, saveParams } from "@/lib/comfyConfig";
import {
  abandonLegacyPresets, buildEnabledBuilderData, composeFromSections,
  fetchLexiconCatalog, loadEnabledMap, loadFixed, loadLocalLists,
  loadLocked, loadSelected, pickRandomSelected, resolveEnabledIds,
  saveEnabledMap, saveFixed, saveLocked, saveSelected, setListEnabled,
  type LexiconIndex, type LocalLexiconList,
} from "@/lib/lexicon";

function parseItemsRaw(raw: string) {
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)[:：]\s*(.*)$/);
    return m
      ? { name: m[1]!.trim(), tags: m[2]!.trim() || m[1]! }
      : { name: line.trim(), tags: line.trim() + ", " };
  });
}

export default function GeneratorPage() {
  const [index, setIndex] = useState<LexiconIndex | null>(null);
  const [localLists, setLocalLists] = useState<LocalLexiconList[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [fixed, setFixed] = useState("1girl, ");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pending, setPending] = useState<{id:string;label:string;listId:string;submitterName:string}[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upLabel, setUpLabel] = useState("");
  const [upCat, setUpCat] = useState("user");
  const [upCatLabel, setUpCatLabel] = useState("用户");
  const [upRaw, setUpRaw] = useState("");
  const [upPublish, setUpPublish] = useState(false);

  const toastMsg = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const reload = useCallback(async (ids: string[], fx: string) => {
    const data = await buildEnabledBuilderData(ids, fx);
    setSections(data.sections);
    try { localStorage.setItem("oc-lexicon-runtime-builder", JSON.stringify(data)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      abandonLegacyPresets();
      try {
        const { index: idx, defaultEnabled: def } = await fetchLexiconCatalog();
        setIndex(idx);
        const locals = loadLocalLists();
        setLocalLists(locals);
        const allIds = [...idx.categories.flatMap((c) => c.lists.map((l) => l.id)), ...locals.map((l) => l.id)];
        const enabled = resolveEnabledIds(allIds, def);
        setEnabledIds(enabled);
        if (!loadEnabledMap()) {
          const map: Record<string, boolean> = {};
          allIds.forEach((id) => { map[id] = def.includes(id); });
          saveEnabledMap(map);
        }
        const fx = loadFixed(idx.fixed || "1girl, ");
        setFixed(fx); setSelected(loadSelected()); setLocked(loadLocked());
        const open: Record<string, boolean> = {};
        idx.categories.forEach((c) => { open[c.id] = true; });
        setOpenCats(open);
        await reload(enabled, fx);
        const me = await fetch("/api/auth/me");
        if (me.ok) {
          const j = await me.json();
          setLoggedIn(!!j.user);
          setIsAdmin(!!j.user?.isAdmin);
          if (j.user?.isAdmin) {
            const pr = await fetch("/api/lexicon/pending");
            if (pr.ok) setPending((await pr.json()).pending || []);
          }
        }
      } catch (e) {
        toastMsg(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const prompt = useMemo(() => composeFromSections(fixed, sections, selected), [fixed, sections, selected]);

  const cats = useMemo(() => {
    const list = index ? index.categories.map((c) => ({ ...c, lists: [...c.lists] })) : [];
    for (const l of localLists) {
      let c = list.find((x) => x.id === l.categoryId);
      if (!c) { c = { id: l.categoryId, label: l.categoryLabel, lists: [] }; list.push(c); }
      if (!c.lists.some((x) => x.id === l.id)) c.lists.push({ id: l.id, label: l.label + "（本地）", path: "" });
    }
    return list;
  }, [index, localLists]);

  const toggle = async (id: string) => {
    const on = !enabledIds.includes(id);
    setListEnabled(id, on);
    const next = on ? [...enabledIds, id] : enabledIds.filter((x) => x !== id);
    setEnabledIds(next);
    const map = loadEnabledMap() || {};
    map[id] = on; saveEnabledMap(map);
    await reload(next, fixed);
    toastMsg(on ? "已启动" : "已关闭");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="sticky top-14 z-40 -mx-4 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur border-b border-neutral-800 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 font-mono text-xs text-neutral-400 bg-[#111] border border-neutral-800 rounded-lg px-3 py-2 max-h-16 overflow-y-auto break-all">{prompt || "（未选择）"}</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={async () => { try { await navigator.clipboard.writeText(prompt); toastMsg("已复制"); } catch { toastMsg("失败"); } }} className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white">复制</button>
            <button onClick={() => { if (!prompt.trim()) return toastMsg("为空"); const cur = loadParams(); saveParams({ ...cur, prompt_character: prompt.trim() }); toastMsg("已写入抽卡姬"); }} className="px-3 py-1.5 text-sm rounded-lg border border-sky-700 text-sky-300">导入到抽卡姬</button>
            <Link href="/comfy" className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300">抽卡姬</Link>
            <button onClick={() => { const n = pickRandomSelected(sections, locked, selected); setSelected(n); saveSelected(n); }} disabled={!sections.length} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 disabled:opacity-40">随机</button>
            <button onClick={() => setUploadOpen(true)} className="px-3 py-1.5 text-sm rounded-lg border border-sky-800 text-sky-300">上传列表</button>
          </div>
        </div>

        <div>
          <Link href="/" className="text-neutral-500 text-sm">← Worlds</Link>
          <h1 className="text-2xl font-bold text-white mt-1">角色外观生成器</h1>
          <p className="text-neutral-500 text-sm">CDN 词库 · 启动后才参与随机</p>
        </div>

        <div className="bg-[#111] border border-neutral-800 rounded-xl p-3 flex gap-2 items-center">
          <span className="text-[11px] text-neutral-500">fixed:</span>
          <input className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" value={fixed} onChange={(e) => { setFixed(e.target.value); saveFixed(e.target.value); }} />
        </div>

        <div className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setCatalogOpen((v) => !v)} className="w-full flex justify-between px-4 py-3 text-left">
            <div>
              <div className="text-sm font-semibold text-neutral-200">启动分区</div>
              <div className="text-[11px] text-neutral-500">已启动 {enabledIds.length} 个</div>
            </div>
            <span className="text-xs text-neutral-400">{catalogOpen ? "▲" : "▼"}</span>
          </button>
          {catalogOpen && (
            <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-2">
              {loading && <p className="text-xs text-neutral-500">加载中…</p>}
              {cats.map((cat) => (
                <div key={cat.id}>
                  <button type="button" className="text-xs text-neutral-300 mb-1" onClick={() => setOpenCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}>
                    {openCats[cat.id] !== false ? "▼" : "▶"} {cat.label}
                  </button>
                  {openCats[cat.id] !== false && (
                    <div className="flex flex-wrap gap-2 pl-3">
                      {cat.lists.map((li) => {
                        const on = enabledIds.includes(li.id);
                        return (
                          <button key={li.id} type="button" onClick={() => void toggle(li.id)}
                            className={`px-2.5 py-1 text-xs rounded-lg border ${on ? "border-emerald-700 text-emerald-200 bg-emerald-950/30" : "border-neutral-800 text-neutral-500"}`}>
                            {on ? "✓ " : "○ "}{li.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="text-center text-neutral-500 py-10 text-sm">{loading ? "加载中…" : "请启动列表"}</p>
        ) : sections.map((sec) => (
          <div key={sec.key} className="bg-[#111] border border-neutral-800 rounded-xl">
            <div className="px-4 py-2 border-b border-neutral-800 flex justify-between">
              <span className="text-sm text-white">{sec.label}</span>
              <button type="button" className="text-[11px] text-neutral-400" onClick={() => {
                setLocked((p) => { const n = { ...p, [sec.key]: !p[sec.key] }; saveLocked(n); return n; });
              }}>{locked[sec.key] ? "已锁定" : "锁定"}</button>
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {sec.items.map((it, i) => (
                <button key={i} type="button" onClick={() => {
                  setSelected((p) => { const n = { ...p, [sec.key]: p[sec.key] === i ? -1 : i }; saveSelected(n); return n; });
                }} className={`px-2 py-1 text-xs rounded-lg border ${selected[sec.key] === i ? "border-purple-500 text-purple-200" : "border-neutral-700 text-neutral-300"}`}>{it.name}</button>
              ))}
            </div>
          </div>
        ))}

        {loggedIn && !isAdmin && (
          <p className="text-[11px] text-neutral-600">当前账号不是管理员。请在 Vercel 设置 ADMIN_USER_IDS 为你的 Discord 用户 ID 后重新部署。</p>
        )}

        {isAdmin && (
          <GeneratorAdminPanel
            index={index}
            setIndex={setIndex}
            enabledIds={enabledIds}
            setEnabledIds={setEnabledIds}
            fixed={fixed}
            reload={reload}
            pending={pending}
            setPending={setPending}
            toastMsg={toastMsg}
          />
        )}
      </main>
      <Footer />

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#111] border border-neutral-700 rounded-xl p-4 space-y-2">
            <h2 className="text-white font-semibold">上传列表</h2>
            <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="名称" value={upLabel} onChange={(e) => setUpLabel(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="分类id" value={upCat} onChange={(e) => setUpCat(e.target.value)} />
              <input className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="分类名" value={upCatLabel} onChange={(e) => setUpCatLabel(e.target.value)} />
            </div>
            <textarea className="w-full min-h-[100px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" placeholder={"名: tags,"} value={upRaw} onChange={(e) => setUpRaw(e.target.value)} />
            <label className="text-xs text-neutral-300 flex gap-2 items-center"><input type="checkbox" checked={upPublish} onChange={(e) => setUpPublish(e.target.checked)} />申请发布 CDN</label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setUploadOpen(false)} className="text-neutral-400 text-sm">取消</button>
              <button className="bg-purple-600 text-white text-sm px-3 py-1 rounded" onClick={async () => {
                const items = parseItemsRaw(upRaw);
                if (!upLabel || !items.length) return toastMsg("填写不完整");
                const { upsertLocalList } = await import("@/lib/lexicon");
                const list = { id: `local/${crypto.randomUUID().slice(0, 8)}`, label: upLabel, categoryId: upCat, categoryLabel: upCatLabel, items, local: true as const, createdAt: new Date().toISOString() };
                upsertLocalList(list);
                setLocalLists(loadLocalLists());
                setListEnabled(list.id, true);
                const next = [...enabledIds, list.id]; setEnabledIds(next);
                const map = loadEnabledMap() || {}; map[list.id] = true; saveEnabledMap(map);
                await reload(next, fixed);
                if (upPublish) {
                  const res = await fetch("/api/lexicon/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: true, categoryId: upCat, categoryLabel: upCatLabel, label: upLabel, items }) });
                  const j = await res.json();
                  toastMsg(res.ok ? (j.message || "已提交") : (j.error || "提交失败"));
                } else toastMsg("已保存本地");
                setUploadOpen(false);
              }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-black text-sm">{toast}</div>}
    </div>
  );
}
