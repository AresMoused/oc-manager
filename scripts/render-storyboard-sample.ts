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

// Bubble shapes (opaque vs transparent) + break-the-frame figures
const c = newStoryboard();
c.title = "透明/不透明对话框与出框人物";
c.panels = [];
c.caption = "";
Object.assign(c, autoLayout(c));
c.frames = [
  c.frames.find((f) => f.kind === "title")!,
  newFrame({ x: 20, y: 120, w: 640, h: 330 }),
  newFrame({ x: 20, y: 466, w: 300, h: 536 }),
  newFrame({ x: 340, y: 466, w: 320, h: 536 }),
];
c.figures = [];
c.bubbles = [];
const shapes = [
  ["narration", "矩形框"], ["rounded", "圆角框"], ["speech", "椭圆气泡"],
  ["thought", "云朵气泡"], ["shout", "爆炸！"], ["wavy", "波浪旁白"],
] as const;
shapes.forEach(([style, text], i) => {
  const x = 50 + i * 102;
  // art behind every box, to show opaque hides it / transparent floats over it
  c.figures.push(newFigure({ pose: "standing", x: x + 20, y: 270, size: 120, style: "box", color: "#9ca3af" }));
  c.figures.push(newFigure({ pose: "standing", x: x + 20, y: 435, size: 120, style: "box", color: "#9ca3af" }));
  c.bubbles.push(newBubble({ style, text, x: x + 4, y: 168, w: 32, h: 90, color: "#222222", tailX: x - 6, tailY: 285 }));
  c.bubbles.push(newBubble({ style, text, x: x + 4, y: 320, w: 32, h: 100, fill: "transparent", border: i % 2 === 0, color: "#222222", tailX: x - 6, tailY: 440 }));
});
c.bubbles.push(
  newBubble({ text: "上排：不透明（遮住背后的图）　下排：透明（有/无细边框）", direction: "horizontal", x: 30, y: 124, w: 620, h: 20, fontSize: 12, fill: "transparent", border: false, textColor: "#e5322d" }),
);
// left: clipped (default); right: break the frame
c.figures.push(newFigure({ pose: "pointing", x: 200, y: 1015, size: 470, style: "stick" }));
c.figures.push(newFigure({ pose: "pointing", x: 540, y: 1015, size: 470, style: "stick", breakFrame: true }));
c.bubbles.push(
  newBubble({ text: "默认：裁剪在分格内", style: "rounded", x: 40, y: 490, w: 30, h: 180, color: "#222222" }),
  newBubble({ text: "出框：画在边框之上", style: "shout", x: 370, y: 495, w: 30, h: 180, color: "#e5322d", textColor: "#e5322d" }),
);
writeFileSync(`${dir}/bubbles-breakframe.svg`, renderStoryboardSvg(c));

// Reference page variant using the new options
const d = sampleStoryboard();
d.bubbles.push(newBubble({ text: "欢迎！", style: "shout", direction: "horizontal", x: 520, y: 790, w: 60, h: 30, fontSize: 16, color: "#222222" }));
const close = d.figures.find((f) => f.style === "bust");
if (close) { close.breakFrame = true; close.size *= 1.15; close.x += 30; }
const walker = d.figures.find((f) => f.pose === "walking");
if (walker) walker.breakFrame = true;
d.bubbles.push(newBubble({ text: "——埃尔达馆", style: "narration", direction: "vertical", fill: "transparent", border: false, x: 470, y: 215, w: 26, h: 130, textColor: "#555555" }));
writeFileSync(`${dir}/sample2.svg`, renderStoryboardSvg(d));
console.log("wrote", dir);
