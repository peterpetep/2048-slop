import { test } from "node:test";
import assert from "node:assert/strict";
import { bpmFor, multFor, windowFor, judge, MIN_BPM, MAX_BPM } from "./beat.js";

test("tempo starts slow, climbs with score, and caps", () => {
  assert.equal(bpmFor(0), MIN_BPM);
  assert.ok(bpmFor(1000) > bpmFor(100));
  assert.equal(bpmFor(1e9), MAX_BPM);
});

test("streak multiplier steps up", () => {
  assert.deepEqual([0, 3, 4, 8, 16, 99].map(multFor), [1, 1, 2, 3, 4, 4]);
});

test("window never drops below 90ms", () => {
  assert.equal(windowFor(MAX_BPM * 10), 90);
  assert.ok(windowFor(80) > 90);
});

test("presses near a beat count once", () => {
  const clock = { last: 1000, next: 1750, beatNo: 3, used: -1, bpm: 80 };
  assert.deepEqual(judge(1050, clock), { near: 3, ok: true });
  assert.deepEqual(judge(1700, clock), { near: 4, ok: true });
  assert.equal(judge(1375, clock).ok, false);
  assert.equal(judge(1050, { ...clock, used: 3 }).ok, false);
});
