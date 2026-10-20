/**
 * Render sample storyboard pages to SVG (used for docs/storyboard/*):
 *   npx tsx scripts/render-storyboard-sample.ts [outDir]
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  autoLayout, newBubble, newFigure, newFrame, newPanel, newStoryboard,
  renderStoryboardSvg, sampleStoryboard,
} from "../src/lib/storyboard";

const dir = process.argv[2] || "docs/storyboard";
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/sample.svg`, renderStoryboardSvg(sampleStoryboard()));

// Element showcase: bubble styles + stick-figure pose presets
const b = newStoryboard();
b.title = "对话框与火柴人示例";
b.panels = [newPanel({ figures: 0 })];
b.caption = "";
Object.assign(b, autoLayout(b));
b.frames = [
  b.frames.find((f) => f.kind === "title")!,
  newFrame({ x: 20, y: 120, w: 640, h: 280 }),
  newFrame({ x: 20, y: 416, w: 640, h: 280 }),
  newFrame({ x: 20, y: 712, w: 640, h: 290 }),
];
b.figures = [];
b.bubbles = [];
const poses = ["standing", "pointing", "waving", "walking", "sitting"] as const;
poses.forEach((pose, i) => {
  b.figures.push(newFigure({ pose, x: 80 + i * 125, y: 380, size: 150, style: i % 2 ? "box" : "stick" }));
  b.bubbles.push(newBubble({ text: ({ standing: "站立", pointing: "指向", waving: "挥手", walking: "行走", sitting: "坐" } as const)[pose], direction: "horizontal", style: "narration", x: 40 + i * 125, y: 135, w: 80, h: 28, fontSize: 13 }));
});
b.figures.push(
  newFigure({ pose: "handshake", x: 120, y: 670, size: 170, style: "box" }),
  newFigure({ pose: "handshake", x: 210, y: 670, size: 170, style: "box", flip: true }),
  newFigure({ pose: "hug", x: 430, y: 670, size: 170 }),
  newFigure({ pose: "hug", x: 505, y: 670, size: 170, flip: true }),
  newFigure({ style: "bust", x: 170, y: 1002, size: 230, color: "#777777" }),
  newFigure({ style: "rough", x: 560, y: 985, size: 250, color: "#e5322d" }),
);
b.bubbles.push(
  newBubble({ text: "很高兴认识你！", style: "speech", direction: "vertical", x: 260, y: 440, w: 30, h: 120, color: "#222222", tailX: 222, tailY: 560 }),
  newBubble({ text: "欢迎回家。", style: "speech", direction: "horizontal", x: 540, y: 440, w: 100, h: 34, color: "#222222", tailX: 515, tailY: 515 }),
  newBubble({ text: "（他会喜欢吗……）", style: "thought", direction: "vertical", x: 330, y: 740, w: 34, h: 160, color: "#222222", tailX: 250, tailY: 830 }),
  newBubble({ text: "竖排旁白框", style: "narration", direction: "vertical", x: 430, y: 730, w: 30, h: 110 }),
);
writeFileSync(`${dir}/elements.svg`, renderStoryboardSvg(b));
console.log("wrote", dir);
