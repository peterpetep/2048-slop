import { test } from "node:test";
import assert from "node:assert/strict";
import { step, MIRROR } from "./logic.js";
import { LEFT, RIGHT, UP } from "../../lib/engine.js";

const noSpawnRand = () => 0.5;
const at = tiles => tiles.filter(t => !t.isNew).map(({ lvl, r, c }) => [lvl, r, c]);

test("the mirror board swaps left and right but keeps up and down", () => {
  assert.equal(MIRROR[LEFT], RIGHT);
  assert.equal(MIRROR[RIGHT], LEFT);
  assert.equal(MIRROR[UP], UP);
});

test("one swipe left moves the first board left and the second board right", () => {
  const a = [{ id: 1, lvl: 1, r: 0, c: 1 }];
  const b = [{ id: 2, lvl: 1, r: 0, c: 1 }];
  const out = step([a, b], 4, LEFT, 11, noSpawnRand);
  assert.deepEqual(at(out.results[0].tiles), [[1, 0, 0]]);
  assert.deepEqual(at(out.results[1].tiles), [[1, 0, 3]]);
});

test("points from both boards add up", () => {
  const pair = [{ id: 1, lvl: 1, r: 0, c: 0 }, { id: 2, lvl: 1, r: 0, c: 1 }];
  const out = step([pair, pair.map(t => ({ ...t, id: t.id + 10 }))], 4, LEFT, 11, noSpawnRand);
  assert.equal(out.gained, 8);
});

test("a move counts when only one board moves, and nothing happens when neither does", () => {
  const stuckLeft = [{ id: 1, lvl: 1, r: 0, c: 0 }];
  const out = step([stuckLeft, stuckLeft.map(t => ({ ...t, id: 2 }))], 4, LEFT, 11, noSpawnRand);
  assert.equal(out.results[0].moved, false);
  assert.equal(out.results[1].moved, true);
  const stuckBoth = [[{ id: 3, lvl: 1, r: 0, c: 0 }], [{ id: 4, lvl: 1, r: 0, c: 3 }]];
  assert.equal(step(stuckBoth, 4, LEFT, 11, noSpawnRand), null);
});

test("the game ends when either board jams", () => {
  // A full 2x2 board with no matching neighbours cannot move; the other board still can.
  const full = [[1, 0, 0], [2, 0, 1], [2, 1, 0], [1, 1, 1]].map(([lvl, r, c], i) => ({ id: 100 + i, lvl, r, c }));
  const open = [{ id: 200, lvl: 1, r: 1, c: 0 }]; // the mirror board slides this one right
  const out = step([full, open], 2, LEFT, 11, noSpawnRand);
  assert.deepEqual(out.jammed, [true, false]);
});
