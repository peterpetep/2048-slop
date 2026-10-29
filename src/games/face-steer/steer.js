// Turns face landmarks into slide directions. Pure functions, so they run under node --test.
// Coordinates are MediaPipe's normalised image coords (0..1, y down), mirrored so they match
// the selfie preview: tilting your head to your right tilts it to the right on screen.

import { UP, RIGHT, DOWN, LEFT } from "../../lib/engine.js";

// Face mesh landmark indices.
const EYE_A = 33, EYE_B = 263, NOSE = 1, FOREHEAD = 10, CHIN = 152;

// roll: degrees, positive when the head tilts toward the right of the screen.
// pitch: where the nose sits between forehead (0) and chin (1); grows when you nod down.
export function headPose(landmarks) {
  if (!landmarks || landmarks.length <= CHIN) return null;
  const pt = i => ({ x: 1 - landmarks[i].x, y: landmarks[i].y });
  let [l, r] = [pt(EYE_A), pt(EYE_B)];
  if (l.x > r.x) [l, r] = [r, l];
  const roll = (Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI;
  const top = pt(FOREHEAD).y, bottom = pt(CHIN).y;
  if (bottom - top <= 0) return null;
  const pitch = (pt(NOSE).y - top) / (bottom - top);
  return { roll, pitch };
}

export const SENSITIVITY = {
  low: { roll: 18, pitch: 0.09 },
  medium: { roll: 12, pitch: 0.06 },
  high: { roll: 8, pitch: 0.04 },
};

// Watches a stream of poses. The first few poses set the neutral position. A move fires when
// the head leaves neutral past the threshold, and the next one needs the head back near neutral
// first, so one tilt is one move. While neutral the baseline drifts slowly to follow posture.
export function createSteer({ roll = 12, pitch = 0.06, calibrateFrames = 10, cooldownMs = 200 } = {}) {
  let samples = [], base = null, armed = true, lastMove = -Infinity;
  const limits = { roll, pitch };

  return {
    get calibrated() { return base !== null; },
    get baseline() { return base; },
    setLimits(next) { Object.assign(limits, next); },
    recenter() { samples = []; base = null; armed = true; },

    // Returns { dir, x, y }: dir is UP/RIGHT/DOWN/LEFT or null; x and y are the offset from
    // neutral as a fraction of the threshold (1 = at the edge), for drawing an indicator.
    update(pose, now) {
      if (!pose) return { dir: null, x: 0, y: 0 };
      if (!base) {
        samples.push(pose);
        if (samples.length >= calibrateFrames) {
          const avg = k => samples.reduce((s, p) => s + p[k], 0) / samples.length;
          base = { roll: avg("roll"), pitch: avg("pitch") };
        }
        return { dir: null, x: 0, y: 0 };
      }
      const x = (pose.roll - base.roll) / limits.roll;
      const y = (pose.pitch - base.pitch) / limits.pitch;
      const far = Math.max(Math.abs(x), Math.abs(y));
      let dir = null;
      if (far < 0.5) {
        armed = true;
        base.roll += (pose.roll - base.roll) * 0.02;
        base.pitch += (pose.pitch - base.pitch) * 0.02;
      } else if (far >= 1 && armed && now - lastMove >= cooldownMs) {
        dir = Math.abs(x) >= Math.abs(y) ? (x > 0 ? RIGHT : LEFT) : (y > 0 ? DOWN : UP);
        armed = false;
        lastMove = now;
      }
      return { dir, x, y };
    },
  };
}
