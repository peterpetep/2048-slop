// Whack-an-Eddy rules. Eddys pop out of holes for a moment. Whack one and it stays dazed for
// WINDOW ms; whack a matching Eddy before that runs out and the pair merges into the next Eddy,
// which pops out of the second hole. A wrong pair costs time. The round ends when the clock does.
// All times are in ms and passed in, so the rules can be tested without a real clock.

export const MAX = 11, ROWS = 3, COLS = 4, HOLES = ROWS * COLS;
export const WINDOW = 1000, START_TIME = 40000, MAX_TIME = 60000, MISS_COST = 3000;

let nextId = 1;
export const mole = (lvl, now, upFor) => ({ id: nextId++, lvl, downAt: now + upFor });

export function newWhack(now = 0) {
  return {
    holes: Array(HOLES).fill(null), held: null, score: 0, merges: 0, top: 1,
    endAt: now + START_TIME, nextSpawn: now + 400, won: false, over: false,
  };
}

// Eddys duck faster and pop up more often as you merge more.
export const upFor = g => Math.max(800, 1900 - g.merges * 20);
export const spawnEvery = g => Math.max(220, 450 - g.merges * 6);
export const maxUp = g => Math.min(8, 4 + Math.floor(g.merges / 8));

// Levels come from 1 up to the best Eddy made so far. Half the time a new Eddy copies one that is
// already up, so there is usually a pair to find.
export function pickLevel(g, rng = Math.random) {
  const up = g.holes.filter(Boolean).map(m => m.lvl);
  if (up.length && rng() < 0.5) return up[Math.floor(rng() * up.length)];
  const top = Math.max(2, Math.min(g.top, MAX - 1));
  return 1 + Math.floor(rng() * top);
}

export function tick(g, now, rng = Math.random) {
  if (g.over) return;
  if (now >= g.endAt) { g.over = true; g.held = null; return; }
  if (g.held && now >= g.held.until) g.held = null;
  if (g.holes.some(m => m && now >= m.downAt)) g.holes = g.holes.map(m => (m && now >= m.downAt ? null : m));
  if (now >= g.nextSpawn) {
    g.nextSpawn = now + spawnEvery(g);
    const empty = g.holes.map((m, i) => (m ? -1 : i)).filter(i => i >= 0);
    if (empty.length && HOLES - empty.length < maxUp(g)) {
      g.holes[empty[Math.floor(rng() * empty.length)]] = mole(pickLevel(g, rng), now, upFor(g));
    }
  }
}

// Returns what happened: "empty", "hold", "same", "merge" or "miss".
export function whack(g, i, now) {
  const m = g.holes[i];
  if (g.over || !m) return { kind: "empty" };
  if (!g.held) {
    g.held = { i, until: now + WINDOW };
    m.downAt = Math.max(m.downAt, now + WINDOW);
    return { kind: "hold" };
  }
  if (g.held.i === i) return { kind: "same" };
  const from = g.held.i, first = g.holes[from];
  g.held = null;
  if (!first || first.lvl !== m.lvl) {
    g.endAt -= MISS_COST;
    if (first) first.downAt = now;
    m.downAt = now;
    return { kind: "miss", lost: MISS_COST, from };
  }
  const lvl = m.lvl + 1, gained = 2 ** lvl, bonus = 600 + lvl * 250;
  g.holes[from] = null;
  g.holes[i] = mole(lvl, now, upFor(g) + 600);
  g.score += gained;
  g.merges++;
  g.top = Math.max(g.top, lvl);
  g.endAt = Math.min(now + MAX_TIME, g.endAt + bonus);
  if (lvl >= MAX) g.won = true;
  return { kind: "merge", lvl, gained, bonus, from };
}

// Move every timestamp forward by dt, used when the game is paused and resumed.
export function shift(g, dt) {
  g.endAt += dt; g.nextSpawn += dt;
  if (g.held) g.held.until += dt;
  for (const m of g.holes) if (m) m.downAt += dt;
}
