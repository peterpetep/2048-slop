import { test } from "node:test";
import assert from "node:assert/strict";
import { slide, spawn, canMove, push, makeRow, interval } from "./logic.js";

const tile = (lvl, r, c, id = r * 10 + c + 100) => ({ id, lvl, r, c });
const at = tiles => tiles.map(t => `${t.lvl}@${t.r},${t.c}`).sort().join(" ");

test("slides use the full height of a 4x5 board", () => {
  const res = slide([tile(1, 0, 0), tile(1, 2, 0)], 5, 4, 2);
  assert.equal(at(res.tiles), "2@4,0");
  assert.equal(res.gained, 4);
});

test("push shifts tiles up and feeds the new row in at the bottom", () => {
  const res = push([tile(3, 4, 1)], 5, [1, 0, 2, 1]);
  assert.equal(res.toppedOut, false);
  assert.equal(at(res.tiles), "1@4,0 1@4,3 2@4,2 3@3,1");
});

test("a tile in the top row tops out", () => {
  const before = [tile(1, 0, 2)];
  const res = push(before, 5, [1, 1, 1, 0]);
  assert.equal(res.toppedOut, true);
  assert.equal(res.tiles, before);
});

test("new rows always leave exactly one gap", () => {
  for (let i = 0; i < 50; i++) assert.equal(makeRow(4).filter(l => !l).length, 1);
});

test("rows speed up but never come faster than every 3 moves", () => {
  assert.equal(interval(0), 5);
  assert.equal(interval(8), 4);
  assert.equal(interval(100), 3);
});

test("canMove checks pairs on a non-square board", () => {
  const full = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) full.push(tile(((r * 4 + c) % 2) + 1 + (r % 2) * 2, r, c));
  assert.equal(canMove(full, 5, 4), false);
  full[0].lvl = full[4].lvl;
  assert.equal(canMove(full, 5, 4), true);
});

test("loose tiles never spawn in the top row", () => {
  for (let i = 0; i < 50; i++) assert.notEqual(spawn([], 5, 4).r, 0);
  const allButTop = [];
  for (let r = 1; r < 5; r++) for (let c = 0; c < 4; c++) allButTop.push(tile(1, r, c));
  assert.equal(spawn(allButTop, 5, 4), null);
});
