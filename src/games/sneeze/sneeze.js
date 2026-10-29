// Sneeze rules: every tile is blown the same way, but each one flies its own distance.
// A weak sneeze nudges every tile one cell. A strong one sends tiles most of the way across,
// with more spread in distance and a chance to drift sideways. Matching tiles merge where they land.
import { newId } from "../../lib/engine.js";

const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// How far one tile flies for a given power (0 = a sniffle, 1 = full charge, more = overcharged).
export function reach(power, size, rand = Math.random) {
  const base = 1 + power * (size - 1);
  const spread = power * 1.5;
  return Math.max(1, Math.round(base + (rand() * 2 - 1) * spread));
}

export function sneeze(tiles, size, dir, power, rand = Math.random, maxLvl = Infinity) {
  const [dr, dc] = VECTORS[dir];
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t };

  // Tiles nearest the far wall fly first, so the ones behind them pile up.
  const order = [...tiles].sort((a, b) => (b.r * dr + b.c * dc) - (a.r * dr + a.c * dc));
  const mergedInto = new Set();
  const consumed = [];
  let moved = false, gained = 0, topLvl = 0;

  // Move tile t one cell by (vr, vc). Returns the tile where it now is, or null if it merged away.
  function stepTile(t, vr, vc) {
    const tr = t.r + vr, tc = t.c + vc;
    if (tr < 0 || tr >= size || tc < 0 || tc >= size) return t;
    const other = grid[tr][tc];
    if (!other) {
      grid[t.r][t.c] = null;
      const next = { ...t, r: tr, c: tc };
      grid[tr][tc] = next;
      moved = true;
      return next;
    }
    if (other.lvl === t.lvl && t.lvl < maxLvl && !mergedInto.has(other.id) && !mergedInto.has(t.id)) {
      grid[t.r][t.c] = null;
      consumed.push({ ...t, r: tr, c: tc }, { ...other });
      const merged = { id: newId(), lvl: t.lvl + 1, r: tr, c: tc, merged: true };
      grid[tr][tc] = merged;
      mergedInto.add(merged.id);
      gained += 2 ** merged.lvl;
      topLvl = Math.max(topLvl, merged.lvl);
      moved = true;
      return null;
    }
    return t;
  }

  for (const start of order) {
    let t = grid[start.r][start.c];
    if (!t || t.id !== start.id) continue;
    let left = reach(power, size, rand);
    while (t && left-- > 0) {
      const next = stepTile(t, dr, dc);
      if (next === t) break;
      t = next;
    }
    // A strong sneeze can knock a tile one cell sideways after it lands.
    if (t && rand() < Math.min(0.6, power * 0.45)) {
      const side = rand() < 0.5 ? 1 : -1;
      stepTile(t, dc * side, dr * side);
    }
  }

  const out = [];
  for (const row of grid) for (const t of row) if (t) out.push(t);
  return { tiles: out, consumed, moved, gained, topLvl };
}
