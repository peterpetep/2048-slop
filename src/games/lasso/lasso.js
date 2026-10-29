// Lasso rules. The board is a SIZE x SIZE grid of tiles { lvl, r, c }. A loop is a list of [x, y]
// points in board units (0..1 across the board). Tiles whose centres fall inside the loop are caught.

export const GAP = 0.03;
export const cellSize = n => (1 - (n + 1) * GAP) / n;
export const centre = (i, n) => GAP + i * (cellSize(n) + GAP) + cellSize(n) / 2;

// Even-odd ray casting. The loop is closed automatically from its last point back to its first.
export function inside([x, y], loop) {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i], [xj, yj] = loop[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function caught(tiles, loop, n) {
  if (loop.length < 3) return [];
  return tiles.filter(t => inside([centre(t.c, n), centre(t.r, n)], loop));
}

export function pathLength(loop) {
  let d = 0;
  for (let i = 1; i < loop.length; i++) d += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
  return d;
}

// Two or three matching tiles go up one level, four to seven go up two, eight or more go up three.
export const levelsGained = count => Math.floor(Math.log2(count));

// What a finished loop does: "merge" when it caught two or more tiles of the same level, "miss" otherwise.
// A merge puts the new tile where the caught tile nearest the loop's middle was.
export function judge(tiles, loop, n, max = 11) {
  const got = caught(tiles, loop, n);
  if (got.length < 2 || got.some(t => t.lvl !== got[0].lvl)) return { kind: "miss", got };
  const mx = loop.reduce((s, p) => s + p[0], 0) / loop.length, my = loop.reduce((s, p) => s + p[1], 0) / loop.length;
  const dist = t => Math.hypot(centre(t.c, n) - mx, centre(t.r, n) - my);
  const keep = got.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const lvl = Math.min(max, got[0].lvl + levelsGained(got.length));
  return { kind: "merge", got, keep, lvl };
}

// The game ends when the board is full and no two tiles match anywhere.
export function stuck(tiles, n, max = 11) {
  if (tiles.length < n * n) return false;
  const seen = new Set();
  for (const t of tiles) {
    if (t.lvl < max && seen.has(t.lvl)) return false;
    seen.add(t.lvl);
  }
  return true;
}
