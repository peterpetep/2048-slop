import { test } from "node:test";
import assert from "node:assert/strict";
import { newDating, swipe, propose, matchingPairs, isOver, eddy, curse, CELLS, CURSE_ROUNDS, MAX } from "./dating.js";

const board = (...lvls) => {
  const g = newDating(() => 0);
  g.cells = Array(CELLS).fill(null);
  lvls.forEach((l, i) => (g.cells[i] = l === "x" ? curse() : l ? eddy(l) : null));
  g.over = false;
  return g;
};
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test("a new game has four Eddys and a proposal", () => {
  const g = newDating();
  assert.equal(g.cells.filter(Boolean).length, 4);
  assert.equal(g.pair.length, 2);
});

test("swiping right on a match merges into the next Eddy", () => {
  const g = board(3, 3, 1);
  g.pair = [0, 1];
  const res = swipe(g, true, () => 0.99);
  assert.equal(res.kind, "match");
  assert.ok(res.correct);
  assert.equal(g.cells[1].lvl, 4);
  assert.equal(g.score, 16);
  assert.equal(g.top, 4);
});

test("swiping right on a mismatch turns the lower Eddy into a heartbreak", () => {
  const g = board(5, 2);
  g.pair = [0, 1];
  const res = swipe(g, true, () => 0.99);
  assert.equal(res.kind, "bad");
  assert.equal(res.correct, false);
  assert.equal(g.cells[1].curse, CURSE_ROUNDS);
  assert.equal(g.cells[0].lvl, 5);
});

test("passing is right on a mismatch and wrong on a match", () => {
  const g = board(1, 2, 3, 3);
  g.pair = [0, 1];
  assert.ok(swipe(g, false, () => 0.99).correct);
  g.pair = [2, 3];
  assert.equal(swipe(g, false, () => 0.99).correct, false);
});

test("heartbreaks heal after CURSE_ROUNDS rounds", () => {
  const g = board(5, 2);
  g.pair = [0, 1];
  swipe(g, true, () => 0.99);
  const id = g.cells[1].id;
  for (let i = 0; i < CURSE_ROUNDS; i++) {
    assert.equal(g.cells[1]?.id, id);
    g.pair = propose(g, () => 0.99);
    swipe(g, false, () => 0.99);
  }
  assert.notEqual(g.cells[1]?.id, id);
});

test("every round adds an Eddy when there is room", () => {
  const g = board(1, 2);
  g.pair = [0, 1];
  swipe(g, false, () => 0.5);
  assert.equal(g.cells.filter(Boolean).length, 3);
});

test("the matchmaker never proposes heartbreaks or the final Eddy as a match", () => {
  const g = board("x", "x", MAX, MAX, 1);
  assert.deepEqual(matchingPairs(g.cells), []);
  const p = propose(g, seq(0, 0, 0));
  assert.ok(p.every(i => !g.cells[i].curse));
});

test("reaching level 11 wins", () => {
  const g = board(MAX - 1, MAX - 1);
  g.pair = [0, 1];
  swipe(g, true, () => 0.99);
  assert.ok(g.won);
});

test("the game ends on a full board with no match and no heartbreak", () => {
  const g = board();
  g.cells = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 11, 11, 11].map(eddy);
  g.pair = propose(g, () => 0);
  assert.equal(isOver(g), true);
  g.cells[15] = curse(2);
  assert.equal(isOver(g), false);
});

test("Eddys keep joining until the matchmaker has two to pair up", () => {
  const g = board(4, 4);
  g.pair = [0, 1];
  swipe(g, true, () => 0.99);
  assert.ok(g.pair);
  assert.ok(g.cells.filter(c => c && !c.curse).length >= 2);
});
