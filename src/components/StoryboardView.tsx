"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StoryboardCanvas, { type Selection } from "@/components/StoryboardCanvas";
import { useAppData } from "@/context/AppDataContext";
import { completeChat, loadApiConfig, loadModelParams } from "@/lib/aiConfig";
import {
  BUBBLE_STYLE_OPTIONS,
  COLOR,
  FIGURE_POSE_OPTIONS,
  FIGURE_STYLE_OPTIONS,
  MAX_SIDE_PANELS,
  PAGE_H,
  PAGE_W,
  PANEL_POSE_OPTIONS,
  POSE_PRESETS,
  STORYBOARD_AI_SYSTEM,
  autoLayout,
  exportStoryboardJson,
  importStoryboardJson,
  layerLabel,
  moveLayer,
  moveLayerTo,
  LAYER_KEY,
  type LayerKind,
  layoutText,
  newBubble,
  newFigure,
  newFrame,
  newPanel,
  newStoryboard,
  parseAiStoryboard,
  renderStoryboardSvg,
  sampleStoryboard,
  type Bubble,
  type BubbleFill,
  type BubbleStyle,
  type Figure,
  type FigurePose,
  type FigureStyle,
  type Frame,
  type PanelPose,
  type StoryPanel,
  type Storyboard,
  type TextDirection,
} from "@/lib/storyboard";

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function svgToImage(svg: string, type: "image/png" | "image/jpeg", scale = 2): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("SVG 加载失败"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W * scale;
    canvas.height = PAGE_H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("导出失败"))), type, 0.92)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-purple-500";
const smallCls =
  "bg-[#0a0a0a] border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-purple-500";
const btnCls =
  "px-3 py-1.5 rounded-lg text-sm border border-neutral-700 text-neutral-200 hover:border-purple-500 hover:text-white transition disabled:opacity-40";
const chipCls =
  "px-2 py-1 rounded-md text-xs border border-neutral-700 text-neutral-300 hover:border-purple-500 hover:text-white transition";

const COLOR_SWATCHES = [COLOR.ink, COLOR.text, COLOR.panel, COLOR.featured, "#777777", "#3b82f6"];

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full ring-2 ${value === c ? "ring-white" : "ring-transparent"}`}
          style={{ background: c }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 bg-transparent" />
    </div>
  );
}

export default function StoryboardView() {
  const { storyboards, setStoryboards, loaded, flush } = useAppData();
  const [activeId, setActiveId] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [newPose, setNewPose] = useState<FigurePose>("standing");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [hasAi, setHasAi] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [dragLayer, setDragLayer] = useState<{ kind: LayerKind; id: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasAi(!!loadApiConfig().apiKey.trim());
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!storyboards.find((s) => s.id === activeId) && storyboards.length) setActiveId(storyboards[0].id);
  }, [loaded, storyboards, activeId]);

  const board = storyboards.find((s) => s.id === activeId) || null;
  const svg = useMemo(() => (board ? renderStoryboardSvg(board) : ""), [board]);

  const replace = (next: Storyboard) =>
    setStoryboards((prev) =>
      prev.map((s) => (s.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : s))
    );
  const update = (patch: Partial<Storyboard>) => board && replace({ ...board, ...patch });

  // ---------------------------------------------------------- selection helpers
  const selBubble = selection?.kind === "bubble" ? board?.bubbles.find((b) => b.id === selection.id) : undefined;
  const selFigure = selection?.kind === "figure" ? board?.figures.find((f) => f.id === selection.id) : undefined;
  const selFrame = selection?.kind === "frame" ? board?.frames.find((f) => f.id === selection.id) : undefined;

  const patchBubble = (id: string, p: Partial<Bubble>) =>
    board && update({ bubbles: board.bubbles.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  const patchFigure = (id: string, p: Partial<Figure>) =>
    board && update({ figures: board.figures.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const patchFrame = (id: string, p: Partial<Frame>) =>
    board && update({ frames: board.frames.map((f) => (f.id === id ? { ...f, ...p } : f)) });

  const deleteSelected = () => {
    if (!board || !selection) return;
    const key = selection.kind === "frame" ? "frames" : selection.kind === "bubble" ? "bubbles" : "figures";
    update({ [key]: (board[key] as { id: string }[]).filter((x) => x.id !== selection.id) } as Partial<Storyboard>);
    setSelection(null);
  };
  const duplicateSelected = () => {
    if (!board || !selection) return;
    const id = crypto.randomUUID();
    if (selBubble) update({ bubbles: [...board.bubbles, { ...selBubble, id, x: selBubble.x + 16, y: selBubble.y + 16, tailX: selBubble.tailX + 16, tailY: selBubble.tailY + 16 }] });
    if (selFigure) update({ figures: [...board.figures, { ...selFigure, id, x: selFigure.x + 20 }] });
    if (selFrame) update({ frames: [...board.frames, { ...selFrame, id, x: selFrame.x + 16, y: selFrame.y + 16 }] });
    setSelection({ kind: selection.kind, id });
  };
  const bringToFront = () => {
    if (!board || !selection) return;
    const key = selection.kind === "frame" ? "frames" : selection.kind === "bubble" ? "bubbles" : "figures";
    const list = board[key] as { id: string }[];
    const it = list.find((x) => x.id === selection.id);
    if (it) update({ [key]: [...list.filter((x) => x !== it), it] } as Partial<Storyboard>);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Where to drop a new element: centre of the selected frame, else page centre */
  const dropPoint = (): [number, number] => {
    const fr = selFrame;
    return fr ? [fr.x + fr.w / 2, fr.y + fr.h / 2] : [PAGE_W / 2, PAGE_H / 2];
  };

  const addBubble = (style: BubbleStyle, direction: TextDirection, fill: BubbleFill = "opaque") => {
    if (!board) return;
    const [cx, cy] = dropPoint();
    const vertical = direction === "vertical";
    const w = vertical ? 44 : 120;
    const h = vertical ? 130 : 50;
    const b = newBubble({
      style, direction, fill, border: fill === "opaque", w, h, x: cx - w / 2, y: cy - h / 2,
      text: style === "narration" ? "旁白" : style === "thought" ? "（心想……）" : style === "shout" ? "什么！？" : "台词！",
      color: style === "narration" || style === "wavy" ? COLOR.text : COLOR.ink,
      tailX: cx - w / 2 - 15, tailY: cy + h / 2 + 35,
    });
    update({ bubbles: [...board.bubbles, b] });
    setSelection({ kind: "bubble", id: b.id });
  };

  const addFigure = (pose: FigurePose) => {
    if (!board) return;
    const [cx, cy] = dropPoint();
    const size = selFrame ? Math.min(140, selFrame.h * 0.6) : 140;
    const foot = cy + size / 2;
    if (pose === "handshake" || pose === "hug") {
      const gap = size * (pose === "hug" ? 0.22 : 0.26);
      const a = newFigure({ pose, x: cx - gap, y: foot, size });
      const b = newFigure({ pose, x: cx + gap, y: foot, size, flip: true });
      update({ figures: [...board.figures, a, b] });
      setSelection({ kind: "figure", id: a.id });
      return;
    }
    const f = newFigure({ pose, x: cx, y: foot, size });
    update({ figures: [...board.figures, f] });
    setSelection({ kind: "figure", id: f.id });
  };

  const addFrame = () => {
    if (!board) return;
    const f = newFrame({ kind: "panel", x: PAGE_W / 2 - 100, y: PAGE_H / 2 - 100 });
    update({ frames: [f, ...board.frames] });
    setSelection({ kind: "frame", id: f.id });
  };

  const fitSelectedBubble = () => {
    if (!selBubble) return;
    const t = layoutText(selBubble.text, 0, 0, selBubble.direction === "vertical" ? 2000 : selBubble.w, selBubble.direction === "vertical" ? selBubble.h : 2000, {
      direction: selBubble.direction, fontSize: selBubble.fontSize, color: "#000",
    });
    const right = selBubble.x + selBubble.w;
    if (selBubble.direction === "vertical") patchBubble(selBubble.id, { w: t.w, h: t.h, x: right - t.w });
    else patchBubble(selBubble.id, { h: t.h });
  };

  // ---------------------------------------------------------- page-level actions
  const create = async (sample = false) => {
    const b = sample ? sampleStoryboard() : newStoryboard();
    if (!sample) {
      b.title = "新的分镜";
      b.frames = b.frames.map((f) => (f.kind === "title" ? { ...f, text: b.title } : f));
    }
    setActiveId(b.id);
    setSelection(null);
    await flush({ storyboards: [b, ...storyboards] }).catch(() => {});
  };
  const remove = async () => {
    if (!board || !confirm(`删除分镜「${board.title || "未命名"}」？`)) return;
    const next = storyboards.filter((s) => s.id !== board.id);
    setActiveId(next[0]?.id || "");
    await flush({ storyboards: next }).catch(() => {});
  };
  const relayout = () => {
    if (!board) return;
    if ((board.bubbles.length || board.figures.length) && !confirm("按分格设定重新排版会覆盖画布上的手动编辑，继续？")) return;
    update(autoLayout(board));
    setSelection(null);
  };
  const setTitle = (title: string) =>
    board && update({ title, frames: board.frames.map((f) => (f.kind === "title" ? { ...f, text: title } : f)) });

  const updatePanel = (id: string, patch: Partial<StoryPanel>) =>
    board && update({ panels: board.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const movePanel = (i: number, d: -1 | 1) => {
    if (!board) return;
    const j = i + d;
    if (j < 0 || j >= board.panels.length) return;
    const next = [...board.panels];
    [next[i], next[j]] = [next[j], next[i]];
    update({ panels: next });
  };

  const fileBase = (board?.title || "storyboard").replace(/[\\/:*?"<>|]/g, "_");
  const exportSvg = () => download(`${fileBase}.svg`, new Blob([svg], { type: "image/svg+xml" }));
  const exportRaster = async (type: "image/png" | "image/jpeg") => {
    setExportOpen(false);
    try {
      download(`${fileBase}.${type === "image/png" ? "png" : "jpg"}`, await svgToImage(svg, type));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "导出失败");
    }
  };
  const exportJson = () => {
    if (!board) return;
    setExportOpen(false);
    download(`${fileBase}.storyboard.json`, new Blob([exportStoryboardJson(board)], { type: "application/json" }));
  };
  const importJson = async (file: File) => {
    try {
      const sb = importStoryboardJson(await file.text());
      setActiveId(sb.id);
      setSelection(null);
      await flush({ storyboards: [sb, ...storyboards] });
      setMsg(`已导入「${sb.title || "未命名"}」`);
    } catch (e) {
      setMsg(e instanceof Error ? `导入失败：${e.message}` : "导入失败");
    }
  };

  // ---------------------------------------------------------- layers
  const patchLayer = (kind: LayerKind, id: string, p: { hidden?: boolean; locked?: boolean; name?: string }) => {
    if (!board) return;
    const key = LAYER_KEY[kind];
    update({ [key]: (board[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } as Partial<Storyboard>);
  };
  const layerGroups: { kind: LayerKind; title: string }[] = [
    { kind: "bubble", title: "对话框" },
    { kind: "figure", title: "人物" },
    { kind: "frame", title: "分格" },
  ];

  const aiDraft = async () => {
    if (!board || !aiPrompt.trim()) return;
    const config = loadApiConfig();
    if (!config.apiKey.trim()) {
      setMsg("请先在「AI生成角色」页的设定中配置 API");
      return;
    }
    setAiBusy(true);
    setMsg("");
    try {
      const text = await completeChat({
        config,
        params: loadModelParams(),
        messages: [
          { role: "system", content: STORYBOARD_AI_SYSTEM },
          { role: "user", content: `故事梗概：${aiPrompt.trim()}` },
        ],
        logSource: "漫画分镜",
        logTitle: "AI 草拟分镜",
      });
      const d = parseAiStoryboard(text);
      const next: Storyboard = {
        ...board,
        title: d.title || board.title,
        caption: d.caption || board.caption,
        monologue: d.monologue || board.monologue,
        panels: d.panels.length ? d.panels : board.panels,
      };
      replace({ ...next, ...autoLayout(next) });
      setSelection(null);
      setMsg("已草拟并排版，可继续在画布上修改");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "AI 草拟失败");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-white mr-2">漫画分镜</h1>
          <select className={inputCls + " !w-auto"} value={activeId} onChange={(e) => { setActiveId(e.target.value); setSelection(null); }}>
            {!storyboards.length && <option value="">（暂无分镜）</option>}
            {storyboards.map((s) => (
              <option key={s.id} value={s.id}>{s.title || "未命名"}</option>
            ))}
          </select>
          <button className={btnCls} onClick={() => create(false)}>+ 新建</button>
          <button className={btnCls} onClick={() => create(true)}>示例页</button>
          {board && <button className={btnCls + " hover:!border-red-500"} onClick={remove}>删除</button>}
          <span className="flex-1" />
          <button className={btnCls} onClick={() => importRef.current?.click()}>导入 JSON</button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importJson(f); }} />
          {board && (
            <div className="relative">
              <button className={btnCls} onClick={() => setExportOpen((v) => !v)}>导出 ▾</button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 z-30 w-56 rounded-xl border border-neutral-800 bg-[#111] p-1 shadow-xl text-sm">
                  <div className="px-3 pt-1.5 pb-1 text-[11px] text-neutral-500">图片 Image</div>
                  <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-200" onClick={() => exportRaster("image/png")}>PNG（2×，白底）</button>
                  <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-200" onClick={() => exportRaster("image/jpeg")}>JPG（2×）</button>
                  <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-200" onClick={() => { setExportOpen(false); exportSvg(); }}>SVG（矢量）</button>
                  <div className="px-3 pt-2 pb-1 text-[11px] text-neutral-500">文档 Document</div>
                  <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-800 text-neutral-200" onClick={exportJson}>JSON（可再导入编辑）</button>
                </div>
              )}
            </div>
          )}
          {msg && <span className="text-xs text-purple-300 w-full">{msg}</span>}
        </div>

        {!loaded ? (
          <p className="text-neutral-500 text-sm">加载中…</p>
        ) : !board ? (
          <p className="text-neutral-500 text-sm">
            一页漫画分镜草稿（ネーム）编辑器：填写标题、中央大格名牌与各分格，自动排版后可在画布上自由拖拽对话框与火柴人。点击「新建」或「示例页」开始。
          </p>
        ) : (
          <div className="grid lg:grid-cols-[320px_minmax(0,560px)_minmax(0,1fr)] gap-5 items-start">
            {/* ---------------- left: page spec */}
            <section className="space-y-3">
              <div className="border border-neutral-800 rounded-2xl p-4 bg-[#111] space-y-3">
                <label className="block text-xs text-neutral-400">
                  标题
                  <input className={inputCls + " mt-1"} value={board.title} onChange={(e) => setTitle(e.target.value)} placeholder="埃尔达馆的贴身小女仆" />
                </label>
                <label className="block text-xs text-neutral-400">
                  中央大格名牌（竖排，如 姓名　年龄）
                  <input className={inputCls + " mt-1"} value={board.caption} onChange={(e) => update({ caption: e.target.value })} placeholder="玛莉卡·埃尔达　十五岁" />
                </label>
                <label className="block text-xs text-neutral-400">
                  中央独白（竖排）
                  <textarea className={inputCls + " mt-1 min-h-[60px]"} value={board.monologue} onChange={(e) => update({ monologue: e.target.value })} />
                </label>
              </div>

              {hasAi && (
                <div className="border border-neutral-800 rounded-2xl p-4 bg-[#111] space-y-2">
                  <div className="text-xs text-neutral-400">AI 草拟分格（使用「AI生成角色」中已配置的 API）</div>
                  <textarea className={inputCls + " min-h-[60px]"} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="一句话故事梗概" />
                  <button className={btnCls} disabled={aiBusy || !aiPrompt.trim()} onClick={aiDraft}>{aiBusy ? "草拟中…" : "AI 草拟分格"}</button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">分格 {board.panels.length}/{MAX_SIDE_PANELS}（右列上→下，再左列）</span>
                <button className={chipCls} disabled={board.panels.length >= MAX_SIDE_PANELS} onClick={() => update({ panels: [...board.panels, newPanel()] })}>+ 分格</button>
              </div>
              {board.panels.map((p, i) => (
                <div key={p.id} className="border border-cyan-900/60 rounded-xl p-2.5 bg-[#0d0d0d] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <span className="text-cyan-300 font-medium">#{i + 1}</span>
                    <select className={smallCls} value={p.pose} onChange={(e) => updatePanel(p.id, { pose: e.target.value as PanelPose })}>
                      {PANEL_POSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="number" min={0} max={6} title="人数" className={smallCls + " w-12"} value={p.figures}
                      onChange={(e) => updatePanel(p.id, { figures: Math.min(6, Math.max(0, Number(e.target.value) || 0)) })} />
                    <span>人</span>
                    <span className="flex-1" />
                    <button className="hover:text-white" onClick={() => movePanel(i, -1)}>↑</button>
                    <button className="hover:text-white" onClick={() => movePanel(i, 1)}>↓</button>
                    <button className="hover:text-red-400" onClick={() => update({ panels: board.panels.filter((x) => x.id !== p.id) })}>✕</button>
                  </div>
                  <textarea className={inputCls + " min-h-[48px] !text-xs"} value={p.text} onChange={(e) => updatePanel(p.id, { text: e.target.value })}
                    placeholder="旁白 / 台词（每行一个竖排对话框）" />
                </div>
              ))}
              <button className={btnCls + " w-full"} onClick={relayout}>按分格自动排版 ↻</button>
            </section>

            {/* ---------------- centre: canvas */}
            <section className="space-y-2 lg:sticky lg:top-20">
              <div className="flex flex-wrap gap-1.5">
                <button className={chipCls} onClick={() => addBubble("narration", "vertical")}>+ 竖排旁白框</button>
                <button className={chipCls} onClick={() => addBubble("speech", "vertical")}>+ 竖排气泡</button>
                <button className={chipCls} onClick={() => addBubble("speech", "horizontal")}>+ 横排气泡</button>
                <button className={chipCls} onClick={() => addBubble("thought", "vertical")}>+ 思考气泡</button>
                <button className={chipCls} onClick={() => addBubble("shout", "horizontal")}>+ 爆炸气泡</button>
                <button className={chipCls} onClick={() => addBubble("narration", "vertical", "transparent")}>+ 透明文字</button>
                <span className="w-px bg-neutral-800 mx-1" />
                <select className={smallCls} value={newPose} onChange={(e) => setNewPose(e.target.value as FigurePose)}>
                  {FIGURE_POSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button className={chipCls} onClick={() => addFigure(newPose)}>+ 火柴人</button>
                <button className={chipCls} onClick={() => addFigure("handshake")}>+ 握手双人</button>
                <button className={chipCls} onClick={() => addFigure("hug")}>+ 拥抱双人</button>
                <span className="w-px bg-neutral-800 mx-1" />
                <button className={chipCls} onClick={addFrame}>+ 分格框</button>
              </div>
              <div className="rounded-xl overflow-hidden ring-1 ring-neutral-800">
                <StoryboardCanvas board={board} selection={selection} onSelect={setSelection} onChange={replace} />
              </div>
              <p className="text-[11px] text-neutral-500">
                点选元素后可拖动；对话框可在右侧切换透明/不透明与形状，火柴人可勾选「出框」画到分格边框之外。右下角方块调整大小，橙色圆点拖动气泡尾巴，绿色圆点拖动火柴人关节。Delete 删除，Esc 取消选择。新元素会放到选中分格的中央。
              </p>
            </section>

            {/* ---------------- right: inspector */}
            <section className="border border-neutral-800 rounded-2xl p-4 bg-[#111] space-y-3 text-xs text-neutral-400 lg:sticky lg:top-20">
              {!selection && <p>未选中元素。点击画布上的对话框、火柴人或分格进行编辑。</p>}
              {selection && (
                <div className="flex flex-wrap gap-1.5">
                  <button className={chipCls} onClick={duplicateSelected}>复制</button>
                  <button className={chipCls} onClick={bringToFront}>置顶</button>
                  <button className={chipCls + " hover:!border-red-500"} onClick={deleteSelected}>删除</button>
                </div>
              )}

              {selBubble && (
                <div className="space-y-2">
                  <div className="text-white text-sm">对话框</div>
                  <textarea className={inputCls + " min-h-[80px]"} value={selBubble.text} onChange={(e) => patchBubble(selBubble.id, { text: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <select className={smallCls} value={selBubble.style} onChange={(e) => patchBubble(selBubble.id, { style: e.target.value as BubbleStyle })}>
                      {BUBBLE_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="flex rounded-lg overflow-hidden border border-neutral-700">
                      {(["opaque", "transparent"] as BubbleFill[]).map((v) => (
                        <button key={v} type="button"
                          className={`px-2 py-1 ${selBubble.fill === v ? "bg-purple-600 text-white" : "text-neutral-300 hover:text-white"}`}
                          onClick={() => patchBubble(selBubble.id, v === "transparent" ? { fill: v } : { fill: v, border: true })}>
                          {v === "opaque" ? "不透明" : "透明"}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={selBubble.border} onChange={(e) => patchBubble(selBubble.id, { border: e.target.checked })} />
                      边框
                    </label>
                    <select className={smallCls} value={selBubble.direction} onChange={(e) => patchBubble(selBubble.id, { direction: e.target.value as TextDirection })}>
                      <option value="vertical">竖排</option>
                      <option value="horizontal">横排</option>
                    </select>
                    <label className="flex items-center gap-1">字号
                      <input type="number" min={8} max={72} className={smallCls + " w-14"} value={selBubble.fontSize}
                        onChange={(e) => patchBubble(selBubble.id, { fontSize: Math.min(72, Math.max(8, Number(e.target.value) || 15)) })} />
                    </label>
                    <button className={chipCls} onClick={fitSelectedBubble}>适配文字尺寸</button>
                  </div>
                  <div className="space-y-1"><div>边框颜色</div><Swatches value={selBubble.color} onChange={(c) => patchBubble(selBubble.id, { color: c })} /></div>
                  <div className="space-y-1"><div>文字颜色</div><Swatches value={selBubble.textColor} onChange={(c) => patchBubble(selBubble.id, { textColor: c })} /></div>
                </div>
              )}

              {selFigure && (
                <div className="space-y-2">
                  <div className="text-white text-sm">火柴人</div>
                  <div className="flex flex-wrap gap-2">
                    <select className={smallCls} value={selFigure.pose}
                      onChange={(e) => {
                        const pose = e.target.value as FigurePose;
                        patchFigure(selFigure.id, { pose, joints: structuredClone(POSE_PRESETS[pose]) });
                      }}>
                      {FIGURE_POSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select className={smallCls} value={selFigure.style} onChange={(e) => patchFigure(selFigure.id, { style: e.target.value as FigureStyle })}>
                      {FIGURE_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button className={chipCls} onClick={() => patchFigure(selFigure.id, { flip: !selFigure.flip })}>水平翻转</button>
                    <label className="flex items-center gap-1" title="出框：画在分格边框之上且不被裁剪，可拖出分格">
                      <input type="checkbox" checked={selFigure.breakFrame} onChange={(e) => patchFigure(selFigure.id, { breakFrame: e.target.checked })} />
                      出框
                    </label>
                    <button className={chipCls} onClick={() => patchFigure(selFigure.id, { joints: structuredClone(POSE_PRESETS[selFigure.pose]) })}>重置关节</button>
                  </div>
                  <label className="flex items-center gap-2">大小
                    <input type="range" min={20} max={800} value={Math.round(selFigure.size)} onChange={(e) => patchFigure(selFigure.id, { size: Number(e.target.value) })} className="flex-1" />
                    <span className="w-10 text-right">{Math.round(selFigure.size)}</span>
                  </label>
                  <div className="space-y-1"><div>颜色</div><Swatches value={selFigure.color} onChange={(c) => patchFigure(selFigure.id, { color: c })} /></div>
                  {(selFigure.style === "bust" || selFigure.style === "rough") && <p className="text-neutral-500">胸像 / 粗稿样式不支持关节编辑，切换为「火柴人」或「方块身」可拖动关节。</p>}
                </div>
              )}

              {selFrame && (
                <div className="space-y-2">
                  <div className="text-white text-sm">{selFrame.kind === "title" ? "标题框" : selFrame.kind === "featured" ? "中央大格" : "分格"}</div>
                  {selFrame.kind === "title" && (
                    <input className={inputCls} value={selFrame.text ?? ""} onChange={(e) => setTitle(e.target.value)} />
                  )}
                  <div className="space-y-1"><div>边框颜色</div><Swatches value={selFrame.color} onChange={(c) => patchFrame(selFrame.id, { color: c })} /></div>
                  <p className="text-neutral-500">拖动分格会带着其中的对话框与人物一起移动。</p>
                </div>
              )}

              <div className="border-t border-neutral-800 pt-3 space-y-2">
                <div className="text-white text-sm">图层 Layers</div>
                <p className="text-neutral-500 text-[11px]">每组内越靠上越在前（对话框始终在人物之上，人物在分格之上；「出框」人物画在所有边框之上）。可拖拽排序，双击重命名。</p>
                {layerGroups.map(({ kind, title }) => {
                  const list = board[LAYER_KEY[kind]] as (Frame | Bubble | Figure)[];
                  // show front-most first
                  const shown = [...list].reverse();
                  return (
                    <div key={kind} className="space-y-0.5">
                      <div className="text-[11px] text-neutral-500">{title}（{list.length}）</div>
                      {shown.map((el) => {
                        const sel = selection?.kind === kind && selection.id === el.id;
                        const idx = list.indexOf(el);
                        return (
                          <div
                            key={el.id}
                            draggable
                            onDragStart={() => setDragLayer({ kind, id: el.id })}
                            onDragOver={(e) => { if (dragLayer?.kind === kind) e.preventDefault(); }}
                            onDrop={() => {
                              if (dragLayer && dragLayer.kind === kind && dragLayer.id !== el.id) replace(moveLayerTo(board, kind, dragLayer.id, idx));
                              setDragLayer(null);
                            }}
                            onClick={() => setSelection({ kind, id: el.id } as Selection)}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer ${sel ? "bg-purple-900/50 text-white" : "hover:bg-neutral-800/70"} ${el.hidden ? "opacity-50" : ""}`}
                          >
                            <span className="cursor-grab text-neutral-600" title="拖拽排序">⋮⋮</span>
                            {renaming === el.id ? (
                              <input autoFocus className={smallCls + " flex-1 min-w-0"} defaultValue={el.name ?? ""}
                                placeholder={layerLabel(kind, { ...el, name: undefined })}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => { patchLayer(kind, el.id, { name: e.target.value.trim() || undefined }); setRenaming(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
                            ) : (
                              <span className="flex-1 truncate" onDoubleClick={() => setRenaming(el.id)}>{layerLabel(kind, el)}</span>
                            )}
                            <button title="上移（更靠前）" className="px-0.5 hover:text-white" onClick={(e) => { e.stopPropagation(); replace(moveLayer(board, kind, el.id, 1)); }}>↑</button>
                            <button title="下移（更靠后）" className="px-0.5 hover:text-white" onClick={(e) => { e.stopPropagation(); replace(moveLayer(board, kind, el.id, -1)); }}>↓</button>
                            <button title={el.hidden ? "显示" : "隐藏"} className="px-0.5 hover:text-white" onClick={(e) => { e.stopPropagation(); patchLayer(kind, el.id, { hidden: !el.hidden }); }}>{el.hidden ? "◌" : "👁"}</button>
                            <button title={el.locked ? "解锁" : "锁定"} className="px-0.5 hover:text-white" onClick={(e) => { e.stopPropagation(); patchLayer(kind, el.id, { locked: !el.locked }); }}>{el.locked ? "🔒" : "🔓"}</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
