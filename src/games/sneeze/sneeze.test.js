import { test } from "node:test";
import assert from "node:assert/strict";
import { sneeze, reach } from "./sneeze.js";
import { RIGHT, LEFT, DOWN } from "../../lib/engine.js";

const tile = (lvl, r, c) => ({ id: Math.random(), lvl, r, c });
const mid = () => 0.5; // no spread, and never drifts sideways
const at = res => res.tiles.map(t => `${t.lvl}@${t.r},${t.c}`).sort().join(" ");

test("a sniffle moves every tile exactly one cell", () => {
  const res = sneeze([tile(1, 0, 0), tile(2, 1, 1)], 4, RIGHT, 0, mid);
  assert.equal(at(res), "1@0,1 2@1,2");
  assert.ok(res.moved);
});

test("a full sneeze blows tiles all the way to the wall", () => {
  const res = sneeze([tile(1, 0, 0), tile(2, 3, 1)], 4, RIGHT, 1, mid);
  assert.equal(at(res), "1@0,3 2@3,3");
});

test("tiles pile up behind the ones ahead of them", () => {
  const res = sneeze([tile(1, 2, 0), tile(2, 2, 1)], 4, RIGHT, 1, mid);
  assert.equal(at(res), "1@2,2 2@2,3");
});

test("matching tiles merge where they land and score points", () => {
  const res = sneeze([tile(3, 0, 0), tile(3, 0, 2)], 4, LEFT, 1, mid);
  assert.equal(at(res), "4@0,0");
  assert.equal(res.gained, 16);
  assert.equal(res.topLvl, 4);
  assert.equal(res.consumed.length, 2);
});

test("a merged tile does not merge again in the same sneeze", () => {
  const res = sneeze([tile(1, 0, 3), tile(1, 1, 3), tile(2, 3, 3)], 4, DOWN, 1, mid);
  assert.equal(at(res), "2@2,3 2@3,3");
});

test("tiles at the max level never merge", () => {
  const res = sneeze([tile(11, 0, 0), tile(11, 0, 1)], 4, LEFT, 1, mid, 11);
  assert.equal(res.tiles.length, 2);
});

test("stronger sneezes are less predictable", () => {
  assert.equal(reach(0, 4, () => 0), 1);
  assert.equal(reach(0, 4, () => 1), 1);
  assert.ok(reach(1, 4, () => 1) - reach(1, 4, () => 0) >= 2);
});

test("a strong sneeze can drift a tile sideways", () => {
  // flight roll 0.5 (to the wall), drift roll 0 (drifts), side roll 0 (down a row)
  const rolls = [0.5, 0, 0];
  const res = sneeze([tile(1, 1, 0)], 4, RIGHT, 1, () => rolls.shift());
  assert.equal(at(res), "1@2,3");
});

test("nothing moves when every tile is stuck against the wall", () => {
  const res = sneeze([tile(1, 0, 3), tile(2, 1, 3)], 4, RIGHT, 1, mid);
  assert.equal(res.moved, false);
});
