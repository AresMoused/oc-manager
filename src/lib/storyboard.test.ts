import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStoryboard,
  parseAiStoryboard,
  renderStoryboardSvg,
  sampleStoryboard,
  sidePanelRects,
  layoutText,
  autoLayout,
  jointToPage,
  pageToJoint,
  newFigure,
} from "./storyboard";

test("vertical text: right-to-left columns, no leading punctuation", () => {
  const t = layoutText("爸爸，妈妈，我找到工作了。", 0, 0, 200, 5 * 15 * 1.12 + 10, { direction: "vertical", fontSize: 15, color: "#000" });
  const glyphs = [...t.svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)];
  assert.ok(Number(glyphs[0][1]) > Number(glyphs[glyphs.length - 1][1]), "first glyph is right of last");
  // the first glyph of every column must not be punctuation
  const tops = glyphs.filter((g, i) => i === 0 || Number(g[2]) < Number(glyphs[i - 1][2]));
  assert.ok(tops.length >= 2);
  for (const g of tops) assert.ok(!"，。！".includes(g[3]), `column starts with ${g[3]}`);
});

test("horizontal text wraps by width", () => {
  const t = layoutText("一二三四五六七八九十", 0, 0, 60, 200, { direction: "horizontal", fontSize: 10, color: "#000" });
  assert.equal([...t.svg.matchAll(/<text /g)].length, 2);
});

test("joint page/local mapping round-trips, incl. flip", () => {
  for (const flip of [false, true]) {
    const f = newFigure({ x: 100, y: 300, size: 150, flip });
    const [px, py] = jointToPage(f, "rHand");
    assert.deepEqual(pageToJoint(f, px, py), f.joints.rHand);
  }
});

test("autoLayout produces frames, bubbles and figures", () => {
  const b = sampleStoryboard();
  const l = autoLayout(b);
  assert.equal(l.frames.filter((f) => f.kind === "panel").length, 6);
  assert.equal(l.frames.filter((f) => f.kind === "featured").length, 1);
  assert.ok(l.bubbles.length >= 10);
  assert.ok(l.figures.some((f) => f.style === "rough"));
});

test("side panels stay on page and within count limit", () => {
  for (let n = 0; n <= 10; n++) {
    const rects = sidePanelRects(n);
    assert.equal(rects.length, Math.min(n, 8));
    for (const r of rects) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 680 && r.y + r.h <= 1020);
  }
});

test("render includes title, caption and escaped text", () => {
  const b = sampleStoryboard();
  b.panels[0].text = "<b>&";
  const svg = renderStoryboardSvg(b);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("《埃尔达馆的贴身小女仆》"));
  assert.ok(svg.includes(">玛<") && svg.includes(">岁<"));
  assert.ok(!svg.includes("<b>"));
});

test("normalize + AI parse are tolerant", () => {
  const n = normalizeStoryboard({ panels: [{ figures: 99, pose: "dance" }], bubbles: [{ style: "x", w: -5 }], figures: [{ pose: "hug", joints: { head: [1, 2] } }] });
  assert.equal(n.bubbles[0].style, "narration");
  assert.equal(n.bubbles[0].w, 16);
  assert.deepEqual(n.figures[0].joints.head, [1, 2]);
  assert.equal(n.panels[0].figures, 6);
  assert.equal(n.panels[0].pose, "standing");
  const d = parseAiStoryboard('```json\n{"title":"T","panels":[{"text":"hi","figures":2,"pose":"handshake"}]}\n```');
  assert.equal(d.title, "T");
  assert.equal(d.panels[0].pose, "handshake");
});
