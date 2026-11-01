import { test } from "node:test";
import assert from "node:assert/strict";
import { viewSize, viewRect, centerSquare } from "./logic.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("a level-1 tile shows exactly its own cell", () => {
  near(viewSize(1, 4, 11), 0.25);
  const v = viewRect(1, 2, 3, 4, 11);
  near(v.x, 0.75); near(v.y, 0.5); near(v.w, 0.25);
});

test("the view widens every level and the top level is the whole picture", () => {
  let prev = 0;
  for (let lvl = 1; lvl <= 11; lvl++) {
    const s = viewSize(lvl, 4, 11);
    assert.ok(s > prev);
    prev = s;
  }
  near(viewSize(6, 4, 11), 0.5);
  assert.deepEqual(viewRect(11, 0, 0, 4, 11), { x: 0, y: 0, w: 1 });
  assert.equal(viewSize(12, 4, 11), 1);
});

test("wide views stay inside the picture", () => {
  for (let lvl = 1; lvl <= 11; lvl++)
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const v = viewRect(lvl, r, c, 4, 11);
        assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= 1 + 1e-9 && v.y + v.w <= 1 + 1e-9);
      }
  const corner = viewRect(6, 0, 0, 4, 11);
  near(corner.x, 0); near(corner.y, 0);
});

test("centerSquare crops landscape and portrait frames", () => {
  assert.deepEqual(centerSquare(640, 480), { sx: 80, sy: 0, s: 480 });
  assert.deepEqual(centerSquare(480, 640), { sx: 0, sy: 80, s: 480 });
});
