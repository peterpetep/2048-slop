// Typing rules. Every Eddy on the board wears a short word. Type a word and that Eddy fires at the
// nearest Eddy of the same level, and the two merge. New Eddys keep spawning, faster as you merge,
// and the game ends when one has nowhere to land. Bigger Eddys wear longer words.
// All times are in ms and passed in, so the rules can be tested without a real clock.

export const MAX = 11, SIZE = 4, CELLS = SIZE * SIZE;
export const START_EVERY = 2600, MIN_EVERY = 900, STEP = 35, DUD_COST = 700;

// LinkedIn words, by length. Level 1-2 Eddys get three letters, and so on up to eight.
export const WORDS = [
  "ceo cto cfo job hub kpi roi pto ask win bio pay app dev biz mba ops sql api wfh gig pod vip zen",
  "hire team grow lead goal sync deck perk role boss desk memo deal zoom loop ping post like demo seed fund talk grit",
  "pivot scale pitch brand agile merge build ideas raise offer boost nudge align churn proof shift learn coach value vibes trend",
  "hustle growth mentor impact launch market thrive leader career intern rocket unlock funnel humble honored domain",
  "synergy network startup disrupt humbled excited roadmap leverage paradigm unicorn innovate",
].map(s => s.split(" "));

export const tierOf = lvl => Math.min(WORDS.length - 1, Math.floor((lvl - 1) / 2));

let nextId = 1;

export function newTyping(now = 0, rng = Math.random) {
  const g = {
    cells: Array(CELLS).fill(null), score: 0, merges: 0, top: 1,
    nextSpawn: now + spawnEvery({ merges: 0 }), won: false, over: false,
  };
  spawn(g, rng, 1);
  spawn(g, rng, 1);
  return g;
}

export const spawnEvery = g => Math.max(MIN_EVERY, START_EVERY - g.merges * STEP);

const words = g => g.cells.filter(Boolean).map(t => t.word);
const clash = (a, b) => a.startsWith(b) || b.startsWith(a);

// Pick a word that no word on the board starts with, and that starts no word on the board, so a
// finished word always names exactly one Eddy.
export function pickWord(g, lvl, rng = Math.random) {
  const taken = words(g);
  for (let t = tierOf(lvl); t < WORDS.length; t++) {
    const free = WORDS[t].filter(w => !taken.some(x => clash(w, x)));
    if (free.length) return free[Math.floor(rng() * free.length)];
  }
  return "eddy" + nextId; // unreachable with 16 cells, but never hand out a duplicate
}

// Usually a fresh small Eddy. Sometimes a copy of one already on the board, so there is a pair to
// fire at, and later in the game sometimes something bigger.
export function pickLevel(g, rng = Math.random) {
  const up = g.cells.filter(t => t && t.lvl < MAX).map(t => t.lvl);
  if (up.length && rng() < 0.35) return up[Math.floor(rng() * up.length)];
  const top = Math.max(1, Math.min(g.top - 2, 6));
  return 1 + Math.floor(rng() * rng() * top);
}

// Drop a new Eddy on a random empty cell. With no empty cell the game is over.
export function spawn(g, rng = Math.random, lvl = pickLevel(g, rng)) {
  const empty = g.cells.map((t, i) => (t ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) { g.over = true; return -1; }
  const i = empty[Math.floor(rng() * empty.length)];
  g.cells[i] = { id: nextId++, lvl, word: pickWord(g, lvl, rng) };
  return i;
}

export function tick(g, now, rng = Math.random) {
  while (!g.over && now >= g.nextSpawn) {
    spawn(g, rng);
    g.nextSpawn += spawnEvery(g);
  }
}

// True when some Eddy's word starts with what has been typed so far.
export const fits = (g, typed) => words(g).some(w => w.startsWith(typed));
export const find = (g, typed) => g.cells.findIndex(t => t && t.word === typed);

const dist = (a, b) => Math.abs((a % SIZE) - (b % SIZE)) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE));

// Nearest other Eddy with the same level, or -1.
export function target(g, from) {
  const lvl = g.cells[from]?.lvl;
  let best = -1;
  g.cells.forEach((t, i) => {
    if (t && i !== from && t.lvl === lvl && (best < 0 || dist(from, i) < dist(from, best))) best = i;
  });
  return best;
}

// Fire the Eddy in cell `from`. Returns { kind: "merge", from, to, lvl, gained } or, when it has
// no match on the board, { kind: "dud", from } and the next spawn comes sooner.
export function fire(g, from, now, rng = Math.random) {
  const shot = g.cells[from];
  if (g.over || !shot) return { kind: "empty" };
  const to = target(g, from);
  if (to < 0) {
    g.nextSpawn = Math.max(now, g.nextSpawn - DUD_COST);
    return { kind: "dud", from };
  }
  const lvl = shot.lvl + 1, gained = 2 ** lvl;
  g.cells[from] = null;
  g.cells[to] = null;
  g.cells[to] = { id: nextId++, lvl, word: pickWord(g, lvl, rng) };
  g.score += gained;
  g.merges++;
  g.top = Math.max(g.top, lvl);
  if (lvl >= MAX) g.won = true;
  return { kind: "merge", from, to, lvl, gained };
}

// Move the spawn clock forward by dt, used when the game is paused and resumed.
export function shift(g, dt) {
  g.nextSpawn += dt;
}
