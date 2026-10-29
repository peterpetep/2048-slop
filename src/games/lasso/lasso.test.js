import { test } from "node:test";
import assert from "node:assert/strict";
import { centre, inside, caught, judge, levelsGained, stuck } from "./lasso.js";

const N = 4;
// A rough rectangle around cells from (r0, c0) to (r1, c1), drawn in board units.
const around = (r0, c0, r1, c1) => {
  const pad = 0.08;
  const x0 = centre(c0, N) - pad, x1 = centre(c1, N) + pad, y0 = centre(r0, N) - pad, y1 = centre(r1, N) + pad;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
};

test("points inside and outside a square", () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.ok(inside([0.5, 0.5], sq));
  assert.ok(!inside([1.5, 0.5], sq));
});

test("a loop catches the tiles whose centres it surrounds", () => {
  const tiles = [{ lvl: 1, r: 0, c: 0 }, { lvl: 1, r: 0, c: 1 }, { lvl: 1, r: 3, c: 3 }];
  assert.deepEqual(caught(tiles, around(0, 0, 0, 1), N), tiles.slice(0, 2));
});

test("matching tiles merge into one, nearer the middle of the loop", () => {
  const tiles = [{ lvl: 2, r: 1, c: 1 }, { lvl: 2, r: 1, c: 2 }];
  const res = judge(tiles, around(1, 1, 1, 2), N);
  assert.equal(res.kind, "merge");
  assert.equal(res.lvl, 3);
  assert.equal(res.got.length, 2);
});

test("a mixed loop, a lone tile or an empty loop is a miss", () => {
  const tiles = [{ lvl: 1, r: 0, c: 0 }, { lvl: 2, r: 0, c: 1 }];
  assert.equal(judge(tiles, around(0, 0, 0, 1), N).kind, "miss");
  assert.equal(judge(tiles, around(0, 0, 0, 0), N).kind, "miss");
  assert.equal(judge(tiles, around(3, 3, 3, 3), N).kind, "miss");
});

test("bigger catches jump more levels, capped at the final Eddy", () => {
  assert.deepEqual([2, 3, 4, 7, 8].map(levelsGained), [1, 1, 2, 2, 3]);
  const four = [0, 1].flatMap(r => [0, 1].map(c => ({ lvl: 10, r, c })));
  assert.equal(judge(four, around(0, 0, 1, 1), N).lvl, 11);
});

test("the game is stuck only when the board is full with no matching pair", () => {
  const full = Array.from({ length: 16 }, (_, i) => ({ lvl: i % 11 + 1, r: Math.floor(i / 4), c: i % 4 }));
  assert.ok(!stuck(full, N));
  const unique = full.map((t, i) => ({ ...t, lvl: i < 11 ? i + 1 : 11 }));
  assert.ok(stuck(unique, N));
  assert.ok(!stuck(unique.slice(1), N));
});
