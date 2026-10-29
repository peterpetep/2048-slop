// Conveyor rules on a rows x cols board (the shared engine only does square boards).
// A tile is { id, lvl, r, c }. Levels start at 1; a level-n tile is worth 2^n points.
import { newId } from "../../lib/engine.js";

const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export function emptyCells(tiles, rows, cols) {
  const taken = new Set(tiles.map(t => t.r * cols + t.c));
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!taken.has(r * cols + c)) cells.push([r, c]);
  return cells;
}

// Loose tiles never land in the top row, so a spawn can't top you out by itself.
export function spawn(tiles, rows, cols, rand = Math.random) {
  const cells = emptyCells(tiles, rows, cols).filter(([r]) => r > 0);
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  return { id: newId(), lvl: rand() < 0.9 ? 1 : 2, r, c };
}

// Same contract as engine.slide: new tiles, tiles consumed by merges (placed where they merged), points gained.
export function slide(tiles, rows, cols, dir, maxLvl = Infinity) {
  const [dr, dc] = VECTORS[dir];
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t };

  const rowOrder = [...Array(rows).keys()], colOrder = [...Array(cols).keys()];
  if (dr === 1) rowOrder.reverse();
  if (dc === 1) colOrder.reverse();
  const mergedInto = new Set();
  const consumed = [];
  let moved = false, gained = 0, topLvl = 0;

  for (const r of rowOrder) for (const c of colOrder) {
    const t = grid[r][c];
    if (!t) continue;
    let nr = r, nc = c;
    for (;;) {
      const tr = nr + dr, tc = nc + dc;
      if (tr < 0 || tr >= rows || tc < 0 || tc >= cols) break;
      const other = grid[tr][tc];
      if (!other) { nr = tr; nc = tc; continue; }
      if (other.lvl === t.lvl && t.lvl < maxLvl && !mergedInto.has(other.id)) {
        grid[r][c] = null;
        consumed.push({ ...t, r: tr, c: tc }, { ...other });
        const merged = { id: newId(), lvl: t.lvl + 1, r: tr, c: tc, merged: true };
        grid[tr][tc] = merged;
        mergedInto.add(merged.id);
        gained += 2 ** merged.lvl;
        topLvl = Math.max(topLvl, merged.lvl);
        moved = true;
        nr = null;
      }
      break;
    }
    if (nr !== null && (nr !== r || nc !== c)) {
      grid[r][c] = null;
      grid[nr][nc] = { ...t, r: nr, c: nc };
      moved = true;
    }
  }

  const out = [];
  for (const row of grid) for (const t of row) if (t) out.push(t);
  return { tiles: out, consumed, moved, gained, topLvl };
}

export function canMove(tiles, rows, cols, maxLvl = Infinity) {
  if (tiles.length < rows * cols) return true;
  const at = new Map(tiles.map(t => [t.r * cols + t.c, t.lvl]));
  for (const t of tiles) {
    if (t.lvl >= maxLvl) continue;
    if (t.c + 1 < cols && at.get(t.r * cols + t.c + 1) === t.lvl) return true;
    if (at.get((t.r + 1) * cols + t.c) === t.lvl) return true;
  }
  return false;
}

// A new row: Eddys in every column but one, so there is always somewhere to slide.
export function makeRow(cols, rand = Math.random) {
  const gap = Math.floor(rand() * cols);
  return Array.from({ length: cols }, (_, c) => (c === gap ? 0 : rand() < 0.8 ? 1 : 2));
}

// Moves between rows: 5 at the start, one fewer every 8 rows, never below 3.
export const interval = pushes => Math.max(3, 5 - Math.floor(pushes / 8));

// Shift every tile up one row and feed `row` in at the bottom. A tile already in the top row
// would fall off, so that tops out: the board is left as it was and `toppedOut` is set.
export function push(tiles, rows, row) {
  if (tiles.some(t => t.r === 0)) return { tiles, toppedOut: true };
  const shifted = tiles.map(t => ({ ...t, r: t.r - 1 }));
  row.forEach((lvl, c) => { if (lvl) shifted.push({ id: newId(), lvl, r: rows - 1, c, entering: true }); });
  return { tiles: shifted, toppedOut: false };
}
