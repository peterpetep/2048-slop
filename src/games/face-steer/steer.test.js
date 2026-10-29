import { test } from "node:test";
import assert from "node:assert/strict";
import { headPose, createSteer } from "./steer.js";
import { UP, RIGHT, DOWN, LEFT } from "../../lib/engine.js";

// A fake face mesh with only the landmarks headPose reads. Raw coords are unmirrored.
function face({ eyeDy = 0, nose = 0.5 } = {}) {
  const lm = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[33] = { x: 0.4, y: 0.4 - eyeDy, z: 0 };
  lm[263] = { x: 0.6, y: 0.4 + eyeDy, z: 0 };
  lm[10] = { x: 0.5, y: 0.2, z: 0 };
  lm[152] = { x: 0.5, y: 0.8, z: 0 };
  lm[1] = { x: 0.5, y: 0.2 + 0.6 * nose, z: 0 };
  return lm;
}

test("headPose reads a level face as zero roll", () => {
  const p = headPose(face());
  assert.ok(Math.abs(p.roll) < 1e-9);
  assert.ok(Math.abs(p.pitch - 0.5) < 1e-9);
});

test("headPose mirrors so a tilt toward screen right is positive", () => {
  // Raw x=0.6 eye drops lower; mirrored it sits on the left, so the head tilts left on screen.
  assert.ok(headPose(face({ eyeDy: 0.05 })).roll < 0);
  assert.ok(headPose(face({ eyeDy: -0.05 })).roll > 0);
});

test("headPose rejects missing faces", () => {
  assert.equal(headPose(null), null);
  assert.equal(headPose([{ x: 0, y: 0 }]), null);
});

function calibrated(opts) {
  const s = createSteer({ calibrateFrames: 3, cooldownMs: 0, ...opts });
  for (let i = 0; i < 3; i++) s.update({ roll: 0, pitch: 0.5 }, i);
  return s;
}

test("calibration ignores the first frames", () => {
  const s = createSteer({ calibrateFrames: 3 });
  assert.equal(s.update({ roll: 40, pitch: 0.5 }, 0).dir, null);
  assert.equal(s.calibrated, false);
  s.update({ roll: 40, pitch: 0.5 }, 1);
  s.update({ roll: 40, pitch: 0.5 }, 2);
  assert.equal(s.calibrated, true);
  assert.equal(s.baseline.roll, 40);
});

test("tilts and nods map to directions", () => {
  const cases = [[{ roll: 20, pitch: 0.5 }, RIGHT], [{ roll: -20, pitch: 0.5 }, LEFT],
    [{ roll: 0, pitch: 0.6 }, DOWN], [{ roll: 0, pitch: 0.4 }, UP]];
  for (const [pose, dir] of cases) {
    const s = calibrated();
    assert.equal(s.update(pose, 10).dir, dir);
  }
});

test("small wobbles do nothing", () => {
  const s = calibrated();
  assert.equal(s.update({ roll: 6, pitch: 0.53 }, 10).dir, null);
});

test("holding a tilt fires once until the head comes back", () => {
  const s = calibrated();
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 10).dir, RIGHT);
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 20).dir, null);
  assert.equal(s.update({ roll: 9, pitch: 0.5 }, 30).dir, null); // between half and full: still disarmed
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 40).dir, null);
  s.update({ roll: 0, pitch: 0.5 }, 50);
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 60).dir, RIGHT);
});

test("the stronger axis wins", () => {
  const s = calibrated();
  assert.equal(s.update({ roll: 14, pitch: 0.62 }, 10).dir, DOWN);
});

test("cooldown blocks rapid repeats", () => {
  const s = calibrated({ cooldownMs: 300 });
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 100).dir, RIGHT);
  s.update({ roll: 0, pitch: 0.5 }, 150);
  assert.equal(s.update({ roll: -20, pitch: 0.5 }, 200).dir, null);
  s.update({ roll: 0, pitch: 0.5 }, 350);
  assert.equal(s.update({ roll: -20, pitch: 0.5 }, 450).dir, LEFT);
});

test("recenter recalibrates", () => {
  const s = calibrated();
  s.recenter();
  assert.equal(s.calibrated, false);
  for (let i = 0; i < 3; i++) s.update({ roll: 20, pitch: 0.5 }, i);
  assert.equal(s.update({ roll: 20, pitch: 0.5 }, 10).dir, null);
});
