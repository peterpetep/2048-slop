import { test } from "node:test";
import assert from "node:assert/strict";
import { newWhack, tick, whack, shift, pickLevel, mole, WINDOW, MISS_COST, START_TIME, MAX_TIME, MAX } from "./whack.js";

const game = (...lvls) => {
  const g = newWhack(0);
  lvls.forEach((l, i) => (g.holes[i] = l ? mole(l, 0, 1500) : null));
  return g;
};

test("a new game has empty holes and a full clock", () => {
  const g = newWhack(1000);
  assert.ok(g.holes.every(h => h === null));
  assert.equal(g.endAt, 1000 + START_TIME);
});

test("Eddys pop up over time and duck when their time is up", () => {
  const g = newWhack(0);
  tick(g, 500, () => 0);
  assert.equal(g.holes.filter(Boolean).length, 1);
  const m = g.holes.find(Boolean);
  tick(g, m.downAt, () => 0.99);
  assert.ok(!g.holes.includes(m));
});

test("whacking two matching Eddys within the window merges them", () => {
  const g = game(3, 3);
  assert.equal(whack(g, 0, 100).kind, "hold");
  const res = whack(g, 1, 100 + WINDOW - 1);
  assert.equal(res.kind, "merge");
  assert.equal(g.holes[0], null);
  assert.equal(g.holes[1].lvl, 4);
  assert.equal(g.score, 16);
  assert.equal(g.top, 4);
  assert.ok(g.endAt > START_TIME);
});

test("a whacked Eddy stays up for the whole window", () => {
  const g = game(2, 2);
  whack(g, 0, 1400);
  tick(g, 2399, () => 0.99);
  assert.equal(g.holes[0]?.lvl, 2);
  assert.equal(g.holes[1], null);
  tick(g, 2400, () => 0.99);
  assert.equal(g.holes[0], null);
});

test("the window runs out and the next whack starts a new pair", () => {
  const g = game(1, 1, 1);
  whack(g, 0, 0);
  tick(g, WINDOW, () => 0.99);
  assert.equal(g.held, null);
  assert.equal(whack(g, 1, WINDOW + 10).kind, "hold");
});

test("a wrong pair costs time and both Eddys duck", () => {
  const g = game(1, 2);
  whack(g, 0, 0);
  const res = whack(g, 1, 100);
  assert.equal(res.kind, "miss");
  assert.equal(g.endAt, START_TIME - MISS_COST);
  tick(g, 100, () => 0.99);
  assert.equal(g.holes[0], null);
  assert.equal(g.holes[1], null);
});

test("whacking an empty hole or the same Eddy twice does nothing", () => {
  const g = game(1, null);
  assert.equal(whack(g, 1, 0).kind, "empty");
  whack(g, 0, 0);
  assert.equal(whack(g, 0, 10).kind, "same");
  assert.equal(g.endAt, START_TIME);
});

test("making Eddy Li (MIT) wins", () => {
  const g = game(MAX - 1, MAX - 1);
  whack(g, 0, 0);
  whack(g, 1, 10);
  assert.ok(g.won);
});

test("the clock never banks more than a minute", () => {
  const g = game(5, 5);
  g.endAt = MAX_TIME;
  whack(g, 0, 0);
  whack(g, 1, 0);
  assert.equal(g.endAt, MAX_TIME);
});

test("the game ends when the clock runs out", () => {
  const g = newWhack(0);
  tick(g, START_TIME);
  assert.ok(g.over);
  assert.equal(whack(g, 0, START_TIME).kind, "empty");
});

test("new levels stay between 1 and the best Eddy made", () => {
  const g = newWhack(0);
  g.top = 6;
  for (let i = 0; i < 50; i++) {
    const l = pickLevel(g);
    assert.ok(l >= 1 && l <= 6);
  }
});

test("shift moves every deadline", () => {
  const g = game(1);
  whack(g, 0, 0);
  shift(g, 5000);
  assert.equal(g.endAt, START_TIME + 5000);
  assert.equal(g.held.until, WINDOW + 5000);
  assert.equal(g.holes[0].downAt, 1500 + 5000);
});
