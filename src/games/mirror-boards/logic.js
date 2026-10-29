// Mirror Boards rules: one direction drives two boards, and the second board is flipped left to right,
// so its left and right are swapped. A move counts if either board moves, and the game ends as soon as
// either board has no moves left.
import { slide, spawn, canMove } from "../../lib/engine.js";

export const MIRROR = [0, 3, 2, 1]; // up, right, down, left as seen by the flipped board

export function step(boards, size, dir, maxLvl, rand = Math.random) {
  const dirs = [dir, MIRROR[dir]];
  const results = boards.map((tiles, i) => {
    const res = slide(tiles, size, dirs[i], maxLvl);
    if (res.moved) {
      const extra = spawn(res.tiles, size, rand);
      if (extra) res.tiles.push({ ...extra, isNew: true });
    }
    return res;
  });
  if (!results.some(r => r.moved)) return null;
  return {
    results,
    gained: results.reduce((sum, r) => sum + r.gained, 0),
    topLvl: Math.max(...results.map(r => r.topLvl)),
    jammed: results.map((r, i) => !canMove(r.moved ? r.tiles : boards[i], size, maxLvl)),
  };
}
