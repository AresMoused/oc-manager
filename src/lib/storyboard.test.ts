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
  framePolygon,
  pointInFrame,
  setFrameCorner,
  shapePreset,
  splitFrameVertical,
  splitFrameHorizontal,
  normalizeFrame,
  layerGroups,
  setMemberGroup,
  regroupByPosition,
  moveInGroup,
  groupMembers,
  pruneMembership,
  isEffectivelyHidden,
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

test("polygon panels: presets, point-in-polygon, corner drag clamps", () => {
  const f = newFrame({ x: 0, y: 0, w: 100, h: 100, shape: shapePreset("trapezoid", 0.2) });
  assert.deepEqual(framePolygon(f), [[20, 0], [80, 0], [100, 100], [0, 100]]);
  assert.ok(pointInFrame(f, 50, 50));
  assert.ok(!pointInFrame(f, 5, 5), "outside the slanted corner");
  // corner cannot cross the opposite corner of its edge
  const g = setFrameCorner(f, "tl", 500);
  assert.ok(g.shape!.tl < g.shape!.tr);
  // dragging back to a rectangle drops the shape (rect = backward-compatible format)
  let r = setFrameCorner(f, "tl", 0);
  r = setFrameCorner(r, "tr", 100);
  assert.equal(r.shape, undefined);
});

test("slanted split produces two non-overlapping polygons with a gutter", () => {
  const f = newFrame({ x: 0, y: 0, w: 200, h: 100 });
  const [a, b] = splitFrameVertical(f, 0.6, 0.4, 10);
  assert.equal(a.id, f.id);
  assert.notEqual(b.id, f.id);
  assert.ok(pointInFrame(a, 10, 50) && !pointInFrame(b, 10, 50));
  assert.ok(pointInFrame(b, 190, 50) && !pointInFrame(a, 190, 50));
  assert.ok(!pointInFrame(a, 100, 50) && !pointInFrame(b, 100, 50), "gutter on the cut line");
  const [u, d] = splitFrameHorizontal(newFrame({ x: 0, y: 0, w: 100, h: 200, shape: shapePreset("slantLeft") }), 0.5, 10);
  assert.ok(u.y + u.h < d.y);
  assert.ok(u.shape && d.shape);
});

test("figures clip to polygon panels; break-frame and JSON keep working", () => {
  const b = newStoryboard();
  b.frames = [newFrame({ id: "p", x: 0, y: 0, w: 200, h: 200, shape: shapePreset("slantRight") })];
  b.bubbles = [];
  b.figures = [newFigure({ id: "f1", x: 100, y: 190, size: 120 })];
  const svg = renderStoryboardSvg(b);
  assert.match(svg, /<clipPath id="fc0"><polygon points=/);
  assert.match(svg, /<g clip-path="url\(#fc0\)"><g data-figure="f1">/);
  b.figures[0].breakFrame = true;
  assert.ok(!/clip-path="url\(#fc0\)"><g data-figure/.test(renderStoryboardSvg(b)));
  const back = importStoryboardJson(exportStoryboardJson(b));
  assert.deepEqual(back.frames[0].shape, b.frames[0].shape);
});

test("rect panels from older documents load unchanged (no shape)", () => {
  const old = normalizeFrame({ id: "x", kind: "panel", x: 1, y: 2, w: 3, h: 4, color: "#000" });
  assert.equal(old.shape, undefined);
  assert.ok(renderStoryboardSvg({ ...newStoryboard(), frames: [old], bubbles: [], figures: [] }).includes('<rect x="1.0" y="2.0"'));
  assert.equal(normalizeFrame({ shape: { tl: -5, tr: 9, br: "x", bl: 0 } }).shape, undefined, "garbage clamps to rect");
});

function groupedBoard() {
  const b = newStoryboard();
  const a = newFrame({ id: "A", x: 0, y: 0, w: 100, h: 100 });
  const c = newFrame({ id: "B", x: 200, y: 0, w: 100, h: 100, shape: shapePreset("trapezoid", 0.3) });
  b.frames = [a, c];
  b.bubbles = [newBubble({ id: "b1", x: 10, y: 10, w: 20, h: 20 }), newBubble({ id: "b2", x: 400, y: 400, w: 20, h: 20 }), newBubble({ id: "b3", x: 20, y: 40, w: 20, h: 20 })];
  b.figures = [newFigure({ id: "f1", x: 250, y: 95, size: 60 })];
  return b;
}

test("membership: containment for legacy docs, explicit frameId is stable", () => {
  const legacy = JSON.parse(JSON.stringify(groupedBoard()));
  for (const x of [...legacy.bubbles, ...legacy.figures]) delete x.frameId;
  const n = normalizeStoryboard(legacy);
  assert.deepEqual(n.bubbles.map((b) => b.frameId), ["A", "", "A"]);
  assert.equal(n.figures[0].frameId, "B");
  // explicit membership survives even when the element sits elsewhere; unknown ids fall back to containment
  legacy.bubbles[1].frameId = "B";
  legacy.bubbles[0].frameId = "nope";
  const m = normalizeStoryboard(legacy);
  assert.equal(m.bubbles[1].frameId, "B");
  assert.equal(m.bubbles[0].frameId, "A");
  // JSON round trip keeps it
  assert.equal(importStoryboardJson(exportStoryboardJson(m)).bubbles[1].frameId, "B");
});

test("layer groups: one per panel + 未分格, move between groups, regroup on drop", () => {
  let b = normalizeStoryboard(groupedBoard());
  let g = layerGroups(b);
  assert.deepEqual(g.map((x) => x.id), ["B", "A", ""]);
  assert.deepEqual(g[1].bubbles.map((x) => x.id), ["b3", "b1"], "front-most first");
  assert.deepEqual(g[2].bubbles.map((x) => x.id), ["b2"]);
  b = setMemberGroup(b, "bubble", "b2", "A");
  assert.equal(layerGroups(b)[1].bubbles.length, 3);
  assert.equal(setMemberGroup(b, "bubble", "b2", "missing"), b, "invalid target ignored");
  // drop b2 into panel B on the canvas
  b = { ...b, bubbles: b.bubbles.map((x) => (x.id === "b2" ? { ...x, x: 240, y: 40 } : x)) };
  b = regroupByPosition(b, "bubble", "b2");
  assert.equal(b.bubbles.find((x) => x.id === "b2")!.frameId, "B");
  // dropped outside → ungrouped
  b = { ...b, bubbles: b.bubbles.map((x) => (x.id === "b2" ? { ...x, x: 600, y: 600 } : x)) };
  assert.equal(regroupByPosition(b, "bubble", "b2").bubbles.find((x) => x.id === "b2")!.frameId, "");
});

test("reorder within group skips other groups; group hide; prune on delete", () => {
  let b = normalizeStoryboard(groupedBoard());
  b = setMemberGroup(b, "bubble", "b2", "B");
  // order b1(A) b2(B) b3(A): moving b1 forward swaps with b3, not b2
  assert.deepEqual(moveInGroup(b, "bubble", "b1", 1).bubbles.map((x) => x.id), ["b3", "b2", "b1"]);
  assert.equal(moveInGroup(b, "bubble", "b3", 1), b, "already front-most in group");
  assert.deepEqual(groupMembers(b, "A"), { bubbles: ["b1", "b3"], figures: [] });
  const hidden = { ...b, frames: b.frames.map((f) => (f.id === "A" ? { ...f, hidden: true } : f)) };
  assert.ok(isEffectivelyHidden(hidden, hidden.bubbles[0]));
  assert.ok(!renderStoryboardSvg(hidden).includes('data-bubble="b1"'));
  assert.ok(renderStoryboardSvg(hidden).includes('data-bubble="b2"'));
  const pruned = pruneMembership({ ...b, frames: b.frames.filter((f) => f.id !== "A") });
  assert.deepEqual(pruned.bubbles.map((x) => x.frameId), ["", "B", ""]);
});

test("figure clipping follows explicit group", () => {
  const b = normalizeStoryboard(groupedBoard());
  assert.match(renderStoryboardSvg(b), /<g clip-path="url\(#fc1\)"><g data-figure="f1">/);
  const ungrouped = setMemberGroup(b, "figure", "f1", "");
  assert.ok(!/clip-path="url\(#fc\d\)"><g data-figure="f1"/.test(renderStoryboardSvg(ungrouped)));
});

test("autoLayout assigns every element to its panel (caption stays with featured)", () => {
  const b = sampleStoryboard();
  const featured = b.frames.find((f) => f.kind === "featured")!;
  assert.ok(b.bubbles.every((x) => x.frameId));
  assert.ok(b.figures.every((x) => x.frameId));
  assert.equal(b.bubbles.find((x) => x.text.includes("玛莉卡"))!.frameId, featured.id);
});
