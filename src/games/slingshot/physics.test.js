import { test } from "node:test";
import assert from "node:assert/strict";
import { W, LEDGE_X, LEDGE_Y, SLING, makeBall, fire, step, launchVelocity, trajectory, nextAmmo, overflowing, MAX_SPEED } from "./physics.js";

const run = (balls, seconds, maxLvl) => {
  let made = [], lost = [];
  for (let t = 0; t < seconds; t += 1 / 240) {
    const res = step(balls, 1 / 240, maxLvl);
    balls = res.balls; made = made.concat(res.made); lost = lost.concat(res.lost);
  }
  return { balls, made, lost };
};

// Pull needed to fling a ball from the sling so it lands on (x, y), at a given launch angle.
const aimAt = (x, y, angle) => {
  const dx = x - SLING.x, dy = y - SLING.y, c = Math.cos(angle), t = Math.tan(angle);
  const v = Math.sqrt((900 * dx * dx) / (2 * c * c * (dx * t + dy)));
  const k = v / MAX_SPEED * 80;
  return [-Math.cos(angle) * k, Math.sin(angle) * k];
};

test("a ball rests on top of the ledge", () => {
  const { balls } = run([makeBall(300, 200, 1)], 2);
  assert.ok(Math.abs(balls[0].y - (LEDGE_Y - balls[0].r)) < 1);
});

test("a ball left of the ledge falls into the pit", () => {
  const { balls, lost } = run([makeBall(LEDGE_X - 40, 200, 1)], 2);
  assert.equal(balls.length, 0);
  assert.equal(lost.length, 1);
});

test("pulling further flings faster, up to a limit", () => {
  const a = launchVelocity(20, 0), b = launchVelocity(40, 0), c = launchVelocity(400, 0);
  // Pulling to the right flings to the left.
  assert.ok(a.vx < 0 && b.vx < a.vx);
  assert.ok(Math.abs(Math.hypot(c.vx, c.vy) - MAX_SPEED) < 1e-6);
});

test("the aiming guide starts at the sling and arcs downward", () => {
  const pts = trajectory(300, -300, 1, 10);
  assert.ok(pts[0].x > SLING.x && pts[0].y < SLING.y);
  assert.ok(pts[9].y > pts[4].y);
});

test("a well aimed shot merges with the matching Eddy", () => {
  const target = makeBall(300, LEDGE_Y - makeBall(0, 0, 3).r, 3);
  const [px, py] = aimAt(300, target.y, Math.PI / 4);
  const { balls, made } = run([target, fire(3, px, py)], 3);
  assert.equal(made.length, 1);
  assert.equal(balls.length, 1);
  assert.equal(balls[0].lvl, 4);
});

test("a shot that falls short drops into the pit", () => {
  const { balls, lost } = run([fire(1, 8, -2)], 3);
  assert.equal(balls.length, 0);
  assert.equal(lost[0].lvl, 1);
});

test("different Eddys stack without merging", () => {
  const { balls } = run([makeBall(300, LEDGE_Y - 20, 1), makeBall(300, LEDGE_Y - 100, 2)], 2);
  assert.equal(balls.length, 2);
});

test("the top level never merges", () => {
  const { balls } = run([makeBall(260, 250, 11), makeBall(W - 45, 250, 11)], 2, 11);
  assert.equal(balls.length, 2);
});

test("ammo is usually a level already in the pile", () => {
  const pile = [makeBall(300, 300, 5)];
  assert.equal(nextAmmo(pile, () => 0), 5);
  assert.equal(nextAmmo([], () => 0), 1);
});

test("overflow ignores balls still flying", () => {
  const b = makeBall(300, 20, 1);
  b.age = 2;
  assert.equal(overflowing([b]), true);
  b.shot = true;
  assert.equal(overflowing([b]), false);
});
