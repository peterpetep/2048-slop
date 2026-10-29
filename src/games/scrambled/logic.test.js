import { test } from "node:test";
import assert from "node:assert/strict";
import { reshuffle, valid, IDENTITY } from "./logic.js";

test("a reshuffle is always a full mapping of the four directions", () => {
  let map = IDENTITY;
  for (let i = 0; i < 200; i++) {
    map = reshuffle(map);
    assert.ok(valid(map));
  }
});

test("every key changes meaning after a reshuffle", () => {
  let map = IDENTITY;
  for (let i = 0; i < 200; i++) {
    const next = reshuffle(map);
    next.forEach((d, key) => assert.notEqual(d, map[key]));
    map = next;
  }
});

test("valid rejects broken saved mappings", () => {
  assert.ok(valid([1, 0, 3, 2]));
  assert.ok(!valid([0, 0, 1, 2]));
  assert.ok(!valid([0, 1, 2]));
  assert.ok(!valid(null));
});
