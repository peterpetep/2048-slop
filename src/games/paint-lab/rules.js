// Paint Lab rules. A tile is { id, hue, lvl, r, c }. Hues sit on a six-step paint wheel,
// with the primaries (red, yellow, blue) on the even steps. Only tiles of the same level interact:
// same color merges up a level, two different primaries mix into the color between them,
// and opposite colors cancel out.
import { emptyCells, newId } from "../../lib/engine.js";

export const HUES = ["Red", "Orange", "Yellow", "Green", "Blue", "Violet"];
export const PRIMARIES = [0, 2, 4];
export const MAX = 7; // a level-7 shade wins
const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// What happens when tile `a` slides into tile `b`: null, or { kind, hue, lvl, points }.
export function combine(a, b) {
  if (a.lvl !== b.lvl) return null;
  const lvl = a.lvl, d = Math.abs(a.hue - b.hue);
  if (d === 0) return lvl < MAX ? { kind: "merge", hue: a.hue, lvl: lvl + 1, points: 2 ** (lvl + 1) } : null;
  if (d === 3) return { kind: "cancel", points: 2 ** lvl * 4 };
  if (a.hue % 2 || b.hue % 2) return null;
  return { kind: "mix", hue: d === 2 ? (a.hue + b.hue) / 2 : 5, lvl, points: 2 ** lvl * 3 };
}

// New tiles are always primaries, mostly level 1.
export function spawn(tiles, size, rand = Math.random) {
  const cells = emptyCells(tiles, size);
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  return { id: newId(), hue: PRIMARIES[Math.floor(rand() * 3)], lvl: rand() < 0.9 ? 1 : 2, r, c };
}

// Slide every tile one way. Same shape as engine.slide: the new tiles, the consumed tiles
// (moved to where they met, so they can animate out), and the points gained.
export function slide(tiles, size, dir) {
  const [dr, dc] = VECTORS[dir];
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t };

  const order = [...Array(size).keys()];
  const rows = dr === 1 ? [...order].reverse() : order;
  const cols = dc === 1 ? [...order].reverse() : order;
  const fresh = new Set();
  const consumed = [];
  let moved = false, gained = 0, topLvl = 0, cancels = 0;

  for (const r of rows) for (const c of cols) {
    const t = grid[r][c];
    if (!t) continue;
    let nr = r, nc = c;
    for (;;) {
      const tr = nr + dr, tc = nc + dc;
      if (tr < 0 || tr >= size || tc < 0 || tc >= size) break;
      const other = grid[tr][tc];
      if (!other) { nr = tr; nc = tc; continue; }
      const res = !fresh.has(other.id) && combine(t, other);
      if (res) {
        grid[r][c] = null;
        consumed.push({ ...t, r: tr, c: tc }, { ...other });
        if (res.kind === "cancel") {
          grid[tr][tc] = null;
          cancels++;
        } else {
          const made = { id: newId(), hue: res.hue, lvl: res.lvl, r: tr, c: tc, merged: true };
          grid[tr][tc] = made;
          fresh.add(made.id);
          topLvl = Math.max(topLvl, made.lvl);
        }
        gained += res.points;
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
  return { tiles: out, consumed, moved, gained, topLvl, cancels };
}

export function canMove(tiles, size) {
  if (tiles.length < size * size) return true;
  const at = new Map(tiles.map(t => [t.r * size + t.c, t]));
  for (const t of tiles) {
    const right = t.c + 1 < size && at.get(t.r * size + t.c + 1);
    const below = at.get((t.r + 1) * size + t.c);
    if ((right && combine(t, right)) || (below && combine(t, below))) return true;
  }
  return false;
}

// Paint color for a tile: a pale wash at level 1, deep pigment by the top level.
const ANGLE = [6, 28, 44, 128, 212, 282];
export function paint(hue, lvl) {
  const k = (lvl - 1) / (MAX - 1);
  const light = Math.round(82 - k * 44), sat = Math.round(45 + k * 28);
  return { bg: `hsl(${ANGLE[hue]} ${sat}% ${light}%)`, dark: light > 62 };
}
