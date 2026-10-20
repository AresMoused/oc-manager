/**
 * Docs screenshot of the grouped layers panel next to the page (needs `npm run build` for the CSS):
 *   npx tsx scripts/render-storyboard-layers.tsx /tmp/layers.html  → open in a headless browser
 */
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, readFileSync } from "fs";
import StoryboardLayers from "@/components/StoryboardLayers";
import { renderStoryboardSvg, sampleStoryboard, newBubble, setMemberGroup } from "@/lib/storyboard";

let b = sampleStoryboard();
const panels = b.frames.filter((f) => f.kind === "panel");
panels[0].name = "分格1 · 找到工作";
panels[2].name = "分格3 · 握手";
panels[2].locked = true;
b.frames.find((f) => f.kind === "featured")!.name = "中央大格 · 玛莉卡";
b.bubbles[0].name = "台词：爸爸妈妈";
const loose = newBubble({ text: "（未分格的旁白）", style: "rounded", x: 440, y: 1000 - 30, w: 120, h: 24, direction: "horizontal", fontSize: 12, color: "#222222", frameId: "" });
b.bubbles.push(loose);
b = setMemberGroup(b, "bubble", loose.id, "");
b.figures[1].hidden = true;
const css = readFileSync(".next/static/css/" + require("fs").readdirSync(".next/static/css")[0], "utf8");
const collapsed = b.frames.filter((f) => f.kind === "panel").slice(3).map((f) => f.id).concat(b.frames.filter((f) => f.kind === "title").map((f) => f.id));
const layers = renderToStaticMarkup(
  <StoryboardLayers board={b} selection={{ kind: "bubble", id: b.bubbles[0].id }} onSelect={() => {}} onChange={() => {}} defaultCollapsed={collapsed} />
);
writeFileSync(process.argv[2] || "/tmp/layers.html", `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body style="background:#0a0a0a;margin:0;font-family:'Noto Sans CJK SC',sans-serif">
<div style="display:flex;gap:20px;padding:20px;align-items:flex-start">
<div style="width:520px;background:#fff;border-radius:12px;overflow:hidden">${renderStoryboardSvg(b).replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>
<div style="width:400px;border:1px solid #262626;border-radius:16px;padding:16px;background:#111">${layers}</div>
</div></body></html>`);
