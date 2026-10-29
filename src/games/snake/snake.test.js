import { test } from "node:test";
import assert from "node:assert/strict";
import { newSnake, step, MAX } from "./snake.js";

const seg = (lvl, r, c) => ({ id: Math.random(), lvl, r, c });
const game = (segs, foods = [], dir = 1) => ({ size: 9, dir, score: 0, eaten: 0, won: false, over: false, segs, foods });
const lv = g => g.segs.map(s => s.lvl).join(" ");
const at = g => g.segs.map(s => `${s.r},${s.c}`).join(" ");

test("a new snake has two segments and two foods", () => {
  const g = newSnake(9);
  assert.equal(g.segs.length, 2);
  assert.equal(g.foods.length, 2);
});

test("moving shifts every segment into the one ahead", () => {
  const g = game([seg(3, 4, 4), seg(1, 4, 3)], [seg(1, 0, 0), seg(1, 0, 1)]);
  step(g, () => 0.5);
  assert.equal(at(g), "4,5 4,4");
});

test("eating adds the food to the tail and merges equal neighbours", () => {
  const g = game([seg(2, 4, 4), seg(1, 4, 3)], [seg(1, 4, 5), seg(1, 0, 0)]);
  const res = step(g, () => 0.99);
  // 2 1 + 1 -> 2 2 -> 3
  assert.equal(lv(g), "3");
  assert.equal(at(g), "4,5");
  assert.equal(res.gained, 4 + 8);
  assert.equal(g.foods.length, 2);
});

test("merges pull the rest of the body forward", () => {
  const g = game([seg(5, 4, 4), seg(3, 4, 3), seg(2, 4, 2)], [seg(2, 4, 5), seg(1, 0, 0)]);
  step(g, () => 0.99);
  // 5 3 2 + 2 -> 5 3 3 -> 5 4
  assert.equal(lv(g), "5 4");
  assert.equal(at(g), "4,5 4,4");
});

test("hitting a wall ends the game", () => {
  const g = game([seg(1, 4, 8)], [seg(1, 0, 0), seg(1, 0, 1)]);
  step(g);
  assert.equal(g.over, true);
});

test("biting yourself ends the game, but chasing your tail does not", () => {
  // A loop of four: head at 4,4 moving up into 3,4, which is the tail.
  const loop = () => [seg(1, 4, 4), seg(2, 4, 5), seg(3, 3, 5), seg(4, 3, 4)];
  const g = game(loop(), [seg(1, 0, 0), seg(1, 0, 1)], 0);
  step(g);
  assert.equal(g.over, false);
  const h = game([...loop(), seg(5, 2, 4)], [seg(1, 0, 0), seg(1, 0, 1)], 0);
  step(h);
  assert.equal(h.over, true);
});

test("making Eddy Li (MIT) wins, and the top level never merges", () => {
  const g = game([seg(MAX - 1, 4, 4)], [seg(MAX - 1, 4, 5), seg(1, 0, 0)]);
  step(g);
  assert.equal(g.won, true);
  const h = game([seg(MAX, 4, 4)], [seg(MAX, 4, 5), seg(1, 0, 0)]);
  step(h);
  assert.equal(lv(h), `${MAX} ${MAX}`);
});
