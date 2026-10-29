// Eddy Dating rules. The board is a 4x4 grid of Eddys. Each round the matchmaker proposes two of
// them. Swipe right and a matching pair merges into the next Eddy; a mismatched pair goes badly and
// the lower Eddy turns into a heartbroken (cursed) tile that blocks its cell for CURSE_ROUNDS rounds.
// Swipe left to pass. Every round ends with a new Eddy joining, and the game ends when the board is
// full, nobody matches, and no heartbreak is left to heal.

export const SIZE = 4, CELLS = SIZE * SIZE, MAX = 11, CURSE_ROUNDS = 6;

let nextId = 1;
export const eddy = lvl => ({ id: nextId++, lvl });
export const curse = (rounds = CURSE_ROUNDS) => ({ id: nextId++, curse: rounds });

const isEddy = c => c && !c.curse;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

export function newDating(rng = Math.random) {
  const g = { cells: Array(CELLS).fill(null), score: 0, top: 1, won: false, over: false, pair: null };
  for (let i = 0; i < 4; i++) addEddy(g, rng);
  g.pair = propose(g, rng);
  return g;
}

// A new Eddy (level 2 one time in ten) joins on an empty cell, if there is one.
export function addEddy(g, rng = Math.random) {
  const empty = g.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return false;
  g.cells[pick(empty, rng)] = eddy(rng() < 0.9 ? 1 : 2);
  return true;
}

export function matchingPairs(cells) {
  const pairs = [];
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      if (isEddy(cells[a]) && isEddy(cells[b]) && cells[a].lvl === cells[b].lvl && cells[a].lvl < MAX) pairs.push([a, b]);
    }
  }
  return pairs;
}

// Half the time the matchmaker gets it right (when a match exists), otherwise it is any two Eddys.
// Returns null when fewer than two Eddys are on the board.
export function propose(g, rng = Math.random) {
  const good = matchingPairs(g.cells);
  if (good.length && rng() < 0.5) return pick(good, rng);
  const ids = g.cells.map((c, i) => (isEddy(c) ? i : -1)).filter(i => i >= 0);
  if (ids.length < 2) return null;
  const a = pick(ids, rng);
  const b = pick(ids.filter(i => i !== a), rng);
  return a < b ? [a, b] : [b, a];
}

export const isMatch = (g, pair) =>
  !!pair && isEddy(g.cells[pair[0]]) && g.cells[pair[0]].lvl === g.cells[pair[1]]?.lvl && g.cells[pair[0]].lvl < MAX;

// Plays one round. right is true for a swipe right. Returns
// { kind: "match" | "bad" | "pass", correct, gained, at } where correct says whether the swipe was the
// right call (merge a match, pass a mismatch) and at is the cell the merge or heartbreak happened on.
export function swipe(g, right, rng = Math.random) {
  if (g.over || !g.pair) return null;
  const [a, b] = g.pair;
  const match = isMatch(g, g.pair);

  // Old heartbreaks heal a little each round.
  g.cells = g.cells.map(c => (c?.curse ? (c.curse > 1 ? { ...c, curse: c.curse - 1 } : null) : c));

  let res;
  if (!right) {
    res = { kind: "pass", correct: !match, gained: 0, at: null };
  } else if (match) {
    const lvl = g.cells[a].lvl + 1;
    g.cells[a] = null;
    g.cells[b] = eddy(lvl);
    const gained = 2 ** lvl;
    g.score += gained;
    g.top = Math.max(g.top, lvl);
    if (lvl === MAX) g.won = true;
    res = { kind: "match", correct: true, gained, at: b };
  } else {
    const at = g.cells[a].lvl <= g.cells[b].lvl ? a : b;
    g.cells[at] = curse();
    res = { kind: "bad", correct: false, gained: 0, at };
  }

  addEddy(g, rng);
  g.pair = propose(g, rng);
  while (!g.pair && addEddy(g, rng)) g.pair = propose(g, rng);
  g.over = isOver(g);
  return res;
}

export function isOver(g) {
  if (!g.pair) return !g.cells.some(c => !c || c.curse);
  return g.cells.every(c => isEddy(c)) && !matchingPairs(g.cells).length;
}
