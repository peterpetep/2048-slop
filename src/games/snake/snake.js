// Snake rules. The snake is a list of segments, head first, each a tile { id, lvl, r, c }.
// Eating a food tile adds it to the tail. Then equal neighbours merge, starting from the tail,
// and the segments behind a merge slide forward one cell. Walls and your own body end the game.
import { newId, emptyCells } from "../../lib/engine.js";

export const MAX = 11;
const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export function newSnake(size, rand = Math.random) {
  const mid = Math.floor(size / 2);
  const g = {
    size, dir: 1, score: 0, eaten: 0, won: false, over: false, foods: [],
    segs: [{ id: newId(), lvl: 2, r: mid, c: mid }, { id: newId(), lvl: 1, r: mid, c: mid - 1 }],
  };
  addFood(g, rand);
  addFood(g, rand);
  return g;
}

// Mostly 1s and 2s, sometimes a match for the tail so long chains can keep merging.
export function addFood(g, rand = Math.random) {
  const cells = emptyCells([...g.segs, ...g.foods], g.size);
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  const roll = rand(), tail = g.segs[g.segs.length - 1].lvl;
  const lvl = roll < 0.6 ? 1 : roll < 0.85 ? 2 : Math.min(tail, 4);
  g.foods.push({ id: newId(), lvl, r, c, isNew: true });
}

export const isReverse = (a, b) => (a + 2) % 4 === b;

// Move one cell in g.dir. Returns the segments consumed by merges (placed where they merged,
// so they can animate out) and the points gained. Mutates g.
export function step(g, rand = Math.random) {
  const consumed = [];
  if (g.over) return { consumed, gained: 0 };
  const [dr, dc] = VECTORS[g.dir];
  const head = g.segs[0], r = head.r + dr, c = head.c + dc;
  const fi = g.foods.findIndex(f => f.r === r && f.c === c);
  // The tail moves out of the way this step unless the snake grows.
  const body = fi < 0 ? g.segs.slice(0, -1) : g.segs;
  if (r < 0 || r >= g.size || c < 0 || c >= g.size || body.some(s => s.r === r && s.c === c)) {
    g.over = true;
    return { consumed, gained: 0 };
  }

  const cells = [[r, c], ...g.segs.map(s => [s.r, s.c])];
  g.segs = g.segs.map(({ id, lvl }) => ({ id, lvl }));
  if (fi >= 0) {
    const [food] = g.foods.splice(fi, 1);
    g.segs.push({ id: food.id, lvl: food.lvl });
    g.eaten++;
  }
  g.segs.forEach((s, i) => { [s.r, s.c] = cells[i]; });

  let gained = 0;
  for (let i = g.segs.length - 1; i > 0; i--) {
    const a = g.segs[i - 1], b = g.segs[i];
    if (a.lvl !== b.lvl || a.lvl >= MAX) continue;
    consumed.push({ ...a }, { ...b, r: a.r, c: a.c });
    g.segs[i - 1] = { id: newId(), lvl: a.lvl + 1, r: a.r, c: a.c, merged: true };
    gained += 2 ** (a.lvl + 1);
    if (a.lvl + 1 === MAX) g.won = true;
    // Everything behind the merge moves up one cell.
    for (let j = g.segs.length - 1; j > i; j--) { g.segs[j].r = g.segs[j - 1].r; g.segs[j].c = g.segs[j - 1].c; }
    g.segs.splice(i, 1);
    i = g.segs.length; // start again from the tail
  }
  g.score += gained;
  for (let n = g.foods.length; n < 2; n++) addFood(g, rand);
  return { consumed, gained };
}
