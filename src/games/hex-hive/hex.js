// Slide-and-merge rules on a honeycomb. Cells use axial coords (q, r) on flat-topped hexes,
// and the hive is every cell within `radius` steps of the center (19 cells for radius 2).
// A tile is { id, lvl, q, r }. Levels start at 1; a level-n tile is worth 2^n points.
import { newId } from "../../lib/engine.js";

// Clockwise from up: up, up-right, down-right, down, down-left, up-left.
export const DIRS = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
// Screen angle of each direction in degrees (0 is right, 90 is down).
export const DIR_ANGLES = [-90, -30, 30, 90, 150, -150];

export function cells(radius) {
  const out = [];
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++)
      if (Math.abs(q + r) <= radius) out.push([q, r]);
  return out;
}

export const inside = (q, r, radius) => Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;

// Center of a cell in hex-size units (distance from center to corner is 1).
export const center = (q, r) => [1.5 * q, Math.sqrt(3) * (r + q / 2)];

const key = (q, r) => q + "," + r;

export function emptyCells(tiles, radius) {
  const taken = new Set(tiles.map(t => key(t.q, t.r)));
  return cells(radius).filter(([q, r]) => !taken.has(key(q, r)));
}

export function spawn(tiles, radius, rand = Math.random) {
  const free = emptyCells(tiles, radius);
  if (!free.length) return null;
  const [q, r] = free[Math.floor(rand() * free.length)];
  return { id: newId(), lvl: rand() < 0.9 ? 1 : 2, q, r };
}

// Nearest of the six directions to a swipe or drag of (dx, dy) on screen.
export function dirFromSwipe(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  let best = 0, bestDiff = Infinity;
  DIR_ANGLES.forEach((d, i) => {
    const diff = Math.abs(((a - d + 540) % 360) - 180);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

// Slide every tile one way. Returns the new tiles, the tiles consumed by merges
// (moved to where they merged, so they can animate out), and the points gained.
export function slide(tiles, radius, dir, maxLvl = Infinity) {
  const [dq, dr] = DIRS[dir];
  const [vx, vy] = center(dq, dr);
  const grid = new Map(tiles.map(t => [key(t.q, t.r), { ...t }]));
  // Tiles furthest along the slide direction move first.
  const along = ([q, r]) => { const [x, y] = center(q, r); return x * vx + y * vy; };
  const order = cells(radius).sort((a, b) => along(b) - along(a));
  const mergedInto = new Set();
  const consumed = [];
  let moved = false, gained = 0, topLvl = 0;

  for (const [q, r] of order) {
    const t = grid.get(key(q, r));
    if (!t) continue;
    let nq = q, nr = r;
    for (;;) {
      const tq = nq + dq, tr = nr + dr;
      if (!inside(tq, tr, radius)) break;
      const other = grid.get(key(tq, tr));
      if (!other) { nq = tq; nr = tr; continue; }
      if (other.lvl === t.lvl && t.lvl < maxLvl && !mergedInto.has(other.id)) {
        grid.delete(key(q, r));
        consumed.push({ ...t, q: tq, r: tr });
        const merged = { id: newId(), lvl: t.lvl + 1, q: tq, r: tr, merged: true };
        grid.set(key(tq, tr), merged);
        consumed.push({ ...other });
        mergedInto.add(merged.id);
        gained += 2 ** merged.lvl;
        topLvl = Math.max(topLvl, merged.lvl);
        moved = true;
        nq = null;
      }
      break;
    }
    if (nq !== null && (nq !== q || nr !== r)) {
      grid.delete(key(q, r));
      grid.set(key(nq, nr), { ...t, q: nq, r: nr });
      moved = true;
    }
  }

  return { tiles: [...grid.values()], consumed, moved, gained, topLvl };
}

export function canMove(tiles, radius, maxLvl = Infinity) {
  if (tiles.length < cells(radius).length) return true;
  const at = new Map(tiles.map(t => [key(t.q, t.r), t.lvl]));
  for (const t of tiles) {
    if (t.lvl >= maxLvl) continue;
    // Checking three directions covers every neighbouring pair once.
    for (const [dq, dr] of DIRS.slice(0, 3))
      if (at.get(key(t.q + dq, t.r + dr)) === t.lvl) return true;
  }
  return false;
}
