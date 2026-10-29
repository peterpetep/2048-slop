import { test } from "node:test";
import assert from "node:assert/strict";
import { newTyping, tick, fire, fits, find, target, pickWord, shift, spawnEvery, WORDS, CELLS, MAX, DUD_COST, START_EVERY } from "./typing.js";

const tile = (lvl, word) => ({ id: Math.random(), lvl, word });
const board = (...tiles) => {
  const g = newTyping(0);
  g.cells = Array(CELLS).fill(null);
  tiles.forEach(([i, lvl, word]) => (g.cells[i] = tile(lvl, word)));
  return g;
};

test("a new game starts with two small Eddys and different words", () => {
  const g = newTyping(0);
  const up = g.cells.filter(Boolean);
  assert.equal(up.length, 2);
  assert.ok(up.every(t => t.lvl === 1 && t.word.length === 3));
  assert.notEqual(up[0].word, up[1].word);
});

test("no word list repeats a word", () => {
  const all = WORDS.flat();
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.every(w => /^[a-z]+$/.test(w)));
});

test("words on the board never start one another", () => {
  const g = newTyping(0);
  for (let t = 0; t < 200 && !g.over; t += 50) tick(g, START_EVERY * t);
  const ws = g.cells.filter(Boolean).map(t => t.word);
  for (const a of ws) for (const b of ws) if (a !== b) assert.ok(!a.startsWith(b), `${a} starts with ${b}`);
});

test("pickWord avoids prefixes of words already up", () => {
  const g = board([0, 7, "humble"]);
  for (let i = 0; i < 50; i++) assert.notEqual(pickWord(g, 7), "humbled");
});

test("fits and find follow the words on the board", () => {
  const g = board([0, 1, "ceo"], [5, 3, "deck"]);
  assert.ok(fits(g, "c"));
  assert.ok(fits(g, "de"));
  assert.ok(!fits(g, "x"));
  assert.equal(find(g, "deck"), 5);
  assert.equal(find(g, "dec"), -1);
});

test("firing merges into the nearest matching Eddy", () => {
  const g = board([0, 2, "ceo"], [3, 2, "job"], [1, 2, "hub"], [2, 1, "kpi"]);
  assert.equal(target(g, 0), 1);
  const res = fire(g, 0, 0);
  assert.equal(res.kind, "merge");
  assert.equal(res.to, 1);
  assert.equal(g.cells[0], null);
  assert.equal(g.cells[1].lvl, 3);
  assert.equal(g.cells[1].word.length, 4);
  assert.equal(g.score, 8);
  assert.equal(g.merges, 1);
});

test("firing with no match is a dud and brings the next spawn closer", () => {
  const g = board([0, 1, "ceo"], [1, 2, "job"]);
  g.nextSpawn = 2000;
  assert.equal(fire(g, 0, 100).kind, "dud");
  assert.equal(g.nextSpawn, 2000 - DUD_COST);
  assert.equal(g.cells[0].lvl, 1);
});

test("Eddys spawn on the clock, faster as you merge, until the board is full", () => {
  const g = newTyping(0);
  tick(g, START_EVERY);
  assert.equal(g.cells.filter(Boolean).length, 3);
  g.merges = 100;
  assert.ok(spawnEvery(g) < START_EVERY);
  tick(g, 1e7);
  assert.ok(g.over);
  assert.equal(g.cells.filter(Boolean).length, CELLS);
});

test("making Eddy Li (MIT) wins", () => {
  const g = board([0, MAX - 1, "synergy"], [1, MAX - 1, "unicorn"]);
  fire(g, 0, 0);
  assert.ok(g.won);
  assert.equal(g.cells[1].lvl, MAX);
});

test("shift pushes the spawn clock back after a pause", () => {
  const g = newTyping(0);
  const at = g.nextSpawn;
  shift(g, 5000);
  assert.equal(g.nextSpawn, at + 5000);
});
