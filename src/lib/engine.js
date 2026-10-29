// Classic slide-and-merge rules on a square grid, shared by any game that wants them.
// A tile is { id, lvl, r, c }. Levels start at 1; a level-n tile is worth 2^n points.

export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

let nextId = 1;
export const newId = () => nextId++;

export function emptyCells(tiles, size) {
  const taken = new Set(tiles.map(t => t.r * size + t.c));
  const cells = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!taken.has(r * size + c)) cells.push([r, c]);
  return cells;
}

export function spawn(tiles, size, rand = Math.random) {
  const cells = emptyCells(tiles, size);
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  return { id: newId(), lvl: rand() < 0.9 ? 1 : 2, r, c };
}

// Slide every tile one way. Returns the new tiles, the tiles consumed by merges
// (moved to where they merged, so they can animate out), and the points gained.
export function slide(tiles, size, dir, maxLvl = Infinity) {
  const [dr, dc] = VECTORS[dir];
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t };

  const order = [...Array(size).keys()];
  const rows = dr === 1 ? [...order].reverse() : order;
  const cols = dc === 1 ? [...order].reverse() : order;
  const mergedInto = new Set();
  const consumed = [];
  let moved = false, gained = 0, topLvl = 0;

  for (const r of rows) for (const c of cols) {
    const t = grid[r][c];
    if (!t) continue;
    let nr = r, nc = c;
    for (;;) {
      const tr = nr + dr, tc = nc + dc;
      if (tr < 0 || tr >= size || tc < 0 || tc >= size) break;
      const other = grid[tr][tc];
      if (!other) { nr = tr; nc = tc; continue; }
      if (other.lvl === t.lvl && t.lvl < maxLvl && !mergedInto.has(other.id)) {
        grid[r][c] = null;
        consumed.push({ ...t, r: tr, c: tc });
        const merged = { id: newId(), lvl: t.lvl + 1, r: tr, c: tc, merged: true };
        grid[tr][tc] = merged;
        consumed.push({ ...other });
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

export function canMove(tiles, size, maxLvl = Infinity) {
  if (tiles.length < size * size) return true;
  const at = new Map(tiles.map(t => [t.r * size + t.c, t.lvl]));
  for (const t of tiles) {
    if (t.lvl >= maxLvl) continue;
    if (at.get(t.r * size + t.c + 1) === t.lvl && t.c + 1 < size) return true;
    if (at.get((t.r + 1) * size + t.c) === t.lvl) return true;
  }
  return false;
}
