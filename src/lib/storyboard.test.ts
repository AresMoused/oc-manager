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
  newBubble,
  newFrame,
  newStoryboard,
  renderBubble,
  moveLayer,
  moveLayerTo,
  exportStoryboardJson,
  importStoryboardJson,
  BUBBLE_STYLE_OPTIONS,
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

test("bubble fill: opaque fills white, transparent has no fill; border toggle", () => {
  for (const { value: style } of BUBBLE_STYLE_OPTIONS) {
    const o = renderBubble(newBubble({ style, text: "啊", fill: "opaque" }));
    const t = renderBubble(newBubble({ style, text: "啊", fill: "transparent", border: false }));
    assert.ok(o.includes('fill="#fff"'), `${style} opaque`);
    assert.ok(!t.includes('fill="#fff"'), `${style} transparent`);
    assert.ok(!/stroke="#4ad66d"/.test(t), `${style} borderless`);
  }
  // each opaque shape is distinct
  const shapes = new Set(BUBBLE_STYLE_OPTIONS.map(({ value }) => renderBubble(newBubble({ id: "x", style: value, text: "" })).replace(/data-bubble="[^"]*"/, "")));
  assert.equal(shapes.size, BUBBLE_STYLE_OPTIONS.length);
});

function boardWithFigure(breakFrame: boolean) {
  const b = newStoryboard();
  b.frames = [newFrame({ id: "p", x: 0, y: 0, w: 200, h: 200 })];
  b.bubbles = [];
  b.figures = [newFigure({ id: "f1", x: 100, y: 190, size: 300, breakFrame })];
  return b;
}

test("figures clip to their panel by default; breakFrame draws unclipped above borders", () => {
  const clipped = renderStoryboardSvg(boardWithFigure(false));
  assert.match(clipped, /<g clip-path="url\(#fc0\)"><g data-figure="f1">/);
  const broken = renderStoryboardSvg(boardWithFigure(true));
  assert.ok(!/clip-path="url\(#fc0\)"><g data-figure/.test(broken));
  assert.ok(broken.indexOf('data-figure="f1"') > broken.lastIndexOf("<rect x=\"0.0\""), "drawn after the frame border");
  assert.equal(normalizeStoryboard(JSON.parse(JSON.stringify(boardWithFigure(true)))).figures[0].breakFrame, true);
});

test("hidden layers are not rendered", () => {
  const b = boardWithFigure(false);
  b.figures[0].hidden = true;
  assert.ok(!renderStoryboardSvg(b).includes("data-figure"));
});

test("layer reorder within kind", () => {
  const b = newStoryboard();
  b.bubbles = ["a", "b", "c"].map((id) => newBubble({ id }));
  assert.deepEqual(moveLayer(b, "bubble", "a", 1).bubbles.map((x) => x.id), ["b", "a", "c"]);
  assert.deepEqual(moveLayer(b, "bubble", "a", -1).bubbles.map((x) => x.id), ["a", "b", "c"]);
  assert.deepEqual(moveLayerTo(b, "bubble", "c", 0).bubbles.map((x) => x.id), ["c", "a", "b"]);
});

test("JSON export/import round-trips and validates", () => {
  const b = sampleStoryboard();
  b.bubbles[0].locked = true;
  b.bubbles[0].name = "第一句";
  b.figures[0].breakFrame = true;
  const back = importStoryboardJson(exportStoryboardJson(b));
  assert.notEqual(back.id, b.id, "import gets a fresh id");
  assert.equal(back.title, b.title);
  assert.equal(back.bubbles.length, b.bubbles.length);
  assert.equal(back.bubbles[0].locked, true);
  assert.equal(back.bubbles[0].name, "第一句");
  assert.equal(back.figures[0].breakFrame, true);
  assert.deepEqual(back.figures[1].joints, b.figures[1].joints);
  assert.throws(() => importStoryboardJson("not json"), /JSON/);
  assert.throws(() => importStoryboardJson("[]"), /对象/);
  assert.throws(() => importStoryboardJson('{"format":"other","version":1}'), /格式/);
  assert.throws(() => importStoryboardJson('{"format":"oc-manager-storyboard","version":99,"storyboard":{}}'), /版本/);
  assert.throws(() => importStoryboardJson('{"title":"x"}'), /没有/);
});
