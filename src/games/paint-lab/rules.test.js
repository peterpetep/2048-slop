import { test } from "node:test";
import assert from "node:assert/strict";
import { combine, slide, spawn, canMove, MAX } from "./rules.js";
import { LEFT } from "../../lib/engine.js";

const RED = 0, ORANGE = 1, YELLOW = 2, GREEN = 3, BLUE = 4, VIOLET = 5;
const tile = (hue, lvl, r, c, id = r * 10 + c + 100) => ({ id, hue, lvl, r, c });
const row = tiles => tiles.sort((a, b) => a.c - b.c).map(t => `${t.hue}.${t.lvl}@${t.c}`).join(" ");

test("primaries mix into the color between them", () => {
  assert.equal(combine({ hue: RED, lvl: 1 }, { hue: YELLOW, lvl: 1 }).hue, ORANGE);
  assert.equal(combine({ hue: YELLOW, lvl: 1 }, { hue: BLUE, lvl: 1 }).hue, GREEN);
  assert.equal(combine({ hue: BLUE, lvl: 2 }, { hue: RED, lvl: 2 }).hue, VIOLET);
  assert.equal(combine({ hue: BLUE, lvl: 2 }, { hue: RED, lvl: 2 }).lvl, 2);
});

test("opposite colors cancel", () => {
  for (const [a, b] of [[RED, GREEN], [YELLOW, VIOLET], [BLUE, ORANGE]])
    assert.equal(combine({ hue: a, lvl: 3 }, { hue: b, lvl: 3 }).kind, "cancel");
});

test("neighbours, secondaries and mismatched levels do nothing", () => {
  assert.equal(combine({ hue: RED, lvl: 1 }, { hue: ORANGE, lvl: 1 }), null);
  assert.equal(combine({ hue: ORANGE, lvl: 1 }, { hue: GREEN, lvl: 1 }), null);
  assert.equal(combine({ hue: RED, lvl: 1 }, { hue: YELLOW, lvl: 2 }), null);
  assert.equal(combine({ hue: RED, lvl: MAX }, { hue: RED, lvl: MAX }), null);
});

test("a cancel clears the cell and later tiles slide into it", () => {
  const res = slide([tile(RED, 1, 0, 0), tile(GREEN, 1, 0, 1), tile(BLUE, 1, 0, 3)], 4, LEFT);
  assert.equal(row(res.tiles), `${BLUE}.1@0`);
  assert.equal(res.cancels, 1);
  assert.equal(res.consumed.length, 2);
});

test("a freshly made tile does not react again in the same move", () => {
  const res = slide([tile(RED, 1, 0, 0), tile(YELLOW, 1, 0, 1), tile(ORANGE, 1, 0, 2)], 4, LEFT);
  assert.equal(row(res.tiles), `${ORANGE}.1@0 ${ORANGE}.1@1`);
});

test("random play always ends", () => {
  let tiles = [spawn([], 4)];
  let steps = 0;
  while (canMove(tiles, 4) && steps < 5000) {
    const res = slide(tiles, 4, steps % 4);
    tiles = res.tiles;
    if (res.moved) { const t = spawn(tiles, 4); if (t) tiles.push(t); }
    else if (tiles.length === 16) { const any = [0, 1, 2, 3].some(d => slide(tiles, 4, d).moved); assert.ok(any); }
    steps++;
  }
  assert.ok(steps > 0);
});
