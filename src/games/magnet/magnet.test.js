import { test } from "node:test";
import assert from "node:assert/strict";
import { S, makeBall, step, blast, spawnBall, crowding, pull } from "./magnet.js";

const run = (balls, seconds, opts) => {
  let made = [];
  for (let t = 0; t < seconds; t += 1 / 240) {
    const res = step(balls, 1 / 240, opts);
    balls = res.balls; made = made.concat(res.made);
  }
  return { balls, made };
};

test("matching Eddys with opposite poles pull together and merge with no input", () => {
  const { balls, made } = run([makeBall(60, 200, 2, 1), makeBall(340, 200, 2, -1)], 4);
  assert.equal(balls.length, 1);
  assert.equal(balls[0].lvl, 3);
  assert.equal(made.length, 1);
});

test("different Eddys clump but do not merge", () => {
  const { balls } = run([makeBall(80, 200, 1, 1), makeBall(320, 200, 3, -1)], 4);
  assert.equal(balls.length, 2);
  const [a, b] = balls;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 2);
});

test("bigger Eddys pull harder, and twice as hard on their own level", () => {
  const small = makeBall(0, 0, 1, 1), big = makeBall(0, 0, 5, -1), twin = makeBall(0, 0, 1, -1);
  assert.ok(pull(small, big) > pull(small, makeBall(0, 0, 2, -1)));
  assert.ok(pull(small, twin) > pull(small, makeBall(0, 0, 2, -1)));
  assert.ok(pull(big, small) < pull(small, big));
  assert.ok(pull(small, makeBall(0, 0, 1, 1)) < 0);
});

test("like poles push matching Eddys apart", () => {
  const { balls } = run([makeBall(180, 200, 1, -1), makeBall(220, 200, 1, -1)], 1);
  assert.equal(balls.length, 2);
  assert.ok(Math.abs(balls[0].x - balls[1].x) > 150);
});

test("a blast throws nearby Eddys away from the click", () => {
  const near = makeBall(220, 200, 1), far = makeBall(390, 20, 1);
  blast([near, far], 200, 200);
  assert.ok(near.vx > 300);
  assert.equal(far.vx, 0);
});

test("Eddys stay on the table", () => {
  const b = makeBall(200, 200, 1);
  b.vx = 5000;
  const { balls } = run([b], 1);
  assert.ok(balls[0].x <= S - balls[0].r + 0.01);
});

test("Eddy Li (MIT) never merges past the top level", () => {
  const { balls } = run([makeBall(100, 200, 11, 1), makeBall(300, 200, 11, -1)], 3, { maxLvl: 11 });
  assert.equal(balls.length, 2);
});

test("spawns land on an edge away from other Eddys", () => {
  const b = spawnBall([makeBall(20, 20, 4)]);
  const edge = Math.min(b.x - b.r, b.y - b.r, S - b.r - b.x, S - b.r - b.y);
  assert.ok(Math.abs(edge) < 0.01);
  assert.ok(Math.hypot(b.x - 20, b.y - 20) > 100);
  assert.ok(crowding([b]) > 0 && crowding([b]) < 0.05);
});
