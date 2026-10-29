import { test } from "node:test";
import assert from "node:assert/strict";
import { slide, canMove, LEFT, RIGHT } from "./engine.js";

const tile = (lvl, r, c, id = r * 10 + c + 100) => ({ id, lvl, r, c });
const levels = tiles => tiles.sort((a, b) => a.c - b.c).map(t => `${t.lvl}@${t.c}`).join(" ");

test("equal tiles merge once per move", () => {
  const row = [tile(1, 0, 0), tile(1, 0, 1), tile(1, 0, 2), tile(1, 0, 3)];
  const res = slide(row, 4, LEFT);
  assert.equal(levels(res.tiles), "2@0 2@1");
  assert.equal(res.gained, 8);
});

test("merges toward the slide direction first", () => {
  const res = slide([tile(1, 0, 0), tile(1, 0, 1), tile(1, 0, 2)], 4, RIGHT);
  assert.equal(levels(res.tiles), "1@2 2@3");
});

test("nothing moves when blocked", () => {
  const res = slide([tile(1, 0, 0), tile(2, 0, 1)], 4, LEFT);
  assert.equal(res.moved, false);
});

test("max level tiles do not merge", () => {
  const res = slide([tile(11, 0, 0), tile(11, 0, 1)], 4, LEFT, 11);
  assert.equal(res.moved, false);
});

test("canMove sees a full board with no pairs as stuck", () => {
  const tiles = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) tiles.push(tile((r + c) % 2 + 1, r, c));
  assert.equal(canMove(tiles, 2), false);
  tiles[1].lvl = 1;
  assert.equal(canMove(tiles, 2), true);
});
