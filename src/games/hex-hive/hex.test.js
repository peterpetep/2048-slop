import { test } from "node:test";
import assert from "node:assert/strict";
import { cells, slide, canMove, dirFromSwipe } from "./hex.js";

const UP = 0, DOWN_RIGHT = 2, DOWN = 3, UP_LEFT = 5;
let id = 1000;
const tile = (lvl, q, r) => ({ id: id++, lvl, q, r });
const at = tiles => tiles.map(t => `${t.lvl}@${t.q},${t.r}`).sort().join(" ");

test("a radius-2 hive has 19 cells", () => {
  assert.equal(cells(2).length, 19);
});

test("tiles slide to the edge of the hive", () => {
  const res = slide([tile(1, 0, 0)], 2, UP);
  assert.equal(at(res.tiles), "1@0,-2");
  const diag = slide([tile(1, 0, 0)], 2, DOWN_RIGHT);
  assert.equal(at(diag.tiles), "1@2,0");
});

test("equal tiles merge once per move, toward the slide direction", () => {
  const col = [tile(1, 0, -2), tile(1, 0, -1), tile(1, 0, 0), tile(1, 0, 1), tile(1, 0, 2)];
  const res = slide(col, 2, DOWN);
  assert.equal(at(res.tiles), "1@0,0 2@0,1 2@0,2");
  assert.equal(res.gained, 8);
});

test("diagonal merges work", () => {
  const res = slide([tile(2, 1, 0), tile(2, -1, 0)], 2, UP_LEFT);
  assert.equal(at(res.tiles), "3@-2,0");
});

test("max level tiles do not merge", () => {
  const res = slide([tile(11, 0, -2), tile(11, 0, -1)], 2, UP, 11);
  assert.equal(res.moved, false);
});

test("canMove sees a full hive with no pairs as stuck", () => {
  // Three-coloring of the hex grid: no two neighbours share (q - r) mod 3.
  const full = cells(2).map(([q, r]) => tile(((q - r) % 3 + 3) % 3 + 1, q, r));
  assert.equal(canMove(full, 2), false);
  full[0].lvl = full[1].lvl;
  assert.equal(canMove(full, 2), true);
});

test("swipes snap to the nearest of six directions", () => {
  assert.equal(dirFromSwipe(0, -50), 0);
  assert.equal(dirFromSwipe(40, -25), 1);
  assert.equal(dirFromSwipe(40, 25), 2);
  assert.equal(dirFromSwipe(0, 50), 3);
  assert.equal(dirFromSwipe(-40, 25), 4);
  assert.equal(dirFromSwipe(-40, -25), 5);
});
