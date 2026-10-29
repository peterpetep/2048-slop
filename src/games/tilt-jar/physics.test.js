import { test } from "node:test";
import assert from "node:assert/strict";
import { W, H, makeBall, step, overflowing, MAX_TILT } from "./physics.js";

const run = (balls, seconds, tilt = 0, maxLvl) => {
  let made = [];
  for (let t = 0; t < seconds; t += 1 / 240) {
    const res = step(balls, 1 / 240, tilt, maxLvl);
    balls = res.balls; made = made.concat(res.made);
  }
  return { balls, made };
};

test("a ball falls and rests on the floor", () => {
  const { balls } = run([makeBall(W / 2, 40, 1)], 2);
  assert.ok(Math.abs(balls[0].y - (H - balls[0].r)) < 1);
});

test("matching balls merge when they touch", () => {
  const { balls, made } = run([makeBall(100, H - 30, 3), makeBall(200, H - 30, 3)], 3, MAX_TILT);
  assert.equal(balls.length, 1);
  assert.equal(balls[0].lvl, 4);
  assert.equal(made.length, 1);
});

test("different balls stack without merging", () => {
  const { balls } = run([makeBall(W / 2, H - 30, 1), makeBall(W / 2, H - 120, 2)], 2);
  assert.equal(balls.length, 2);
  const [low, high] = balls.sort((a, b) => b.y - a.y);
  assert.ok(high.y + high.r <= low.y - low.r + 2);
});

test("the top level never merges", () => {
  const { balls } = run([makeBall(80, H - 70, 11), makeBall(220, H - 70, 11)], 2, MAX_TILT, 11);
  assert.equal(balls.length, 2);
});

test("tilting rolls balls toward the low wall", () => {
  const { balls } = run([makeBall(W / 2, H - 30, 1)], 2, MAX_TILT);
  assert.ok(balls[0].x > W - balls[0].r - 1);
});

test("overflow ignores freshly dropped balls", () => {
  const fresh = makeBall(W / 2, 20, 1);
  assert.equal(overflowing([fresh]), false);
  fresh.age = 2;
  assert.equal(overflowing([fresh]), true);
});
