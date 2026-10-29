import { test } from "node:test";
import assert from "node:assert/strict";
import { botTurn } from "./bot.js";

const t = (lvl, r, c) => ({ id: `${r}${c}`, lvl, r, c });

test("bot slides in its planned direction when it moves something", () => {
  const res = botTurn([t(1, 3, 0)], 4, 0, 11);
  assert.equal(res.dir, 0);
  assert.deepEqual(res.skipped, []);
  assert.equal(res.next, 1);
  assert.equal(res.tiles[0].r, 0);
});

test("bot skips slides that move nothing", () => {
  // a lone tile in the top-right corner can't go up or right
  const res = botTurn([t(1, 0, 3)], 4, 0, 11);
  assert.deepEqual(res.skipped, [0, 1]);
  assert.equal(res.dir, 2);
  assert.equal(res.next, 3);
});

test("bot reports game over when nothing can move", () => {
  const tiles = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) tiles.push(t(((r + c) % 2) + 1, r, c));
  const res = botTurn(tiles, 4, 2, 11);
  assert.equal(res.dir, null);
  assert.equal(res.skipped.length, 4);
  assert.equal(res.next, 2);
});
