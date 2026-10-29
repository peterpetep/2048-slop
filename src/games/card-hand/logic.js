// Card Hand rules: classic 2048 on a 4x4 board, but every move is a card played from a hand.
// Cards are { id, type }. A deck is { draw, hand, discard }, three arrays of cards.
// Locks freeze a row or column for a few cards: locked cells are walls that nothing enters or leaves.
import { canMove, newId } from "../../lib/engine.js";

export const SIZE = 4, MAX = 11, HAND = 5, LOCK_CARDS = 3, PROMOTE_MAX = 5;
const VECTORS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const ARROWS = ["↑", "→", "↓", "←"];
const NAMES = ["Up", "Right", "Down", "Left"];

// type -> how the card looks and what it needs. `aim` is what the player picks after choosing it.
export const CARDS = {};
NAMES.forEach((name, dir) => {
  CARDS[`s${dir}`] = { kind: "slide", dir, times: 1, icon: ARROWS[dir], name, text: `Slide everything ${name.toLowerCase()}.` };
  CARDS[`d${dir}`] = { kind: "slide", dir, times: 2, icon: ARROWS[dir].repeat(2), name: `${name} ×2`,
    text: `Slide ${name.toLowerCase()} twice. Only one new Eddy.` };
});
Object.assign(CARDS, {
  wild: { kind: "aim", aim: "dir", icon: "✦", name: "Any way", text: "Slide in the direction of your choice.",
    flavor: "Thought leader" },
  swap: { kind: "aim", aim: "two", icon: "⇄", name: "Swap", text: "Swap two Eddys.", flavor: "Open to new opportunities" },
  fire: { kind: "aim", aim: "tile", icon: "✕", name: "Let go", text: "Remove one Eddy.", flavor: "We're restructuring" },
  promote: { kind: "aim", aim: "tile", icon: "★", name: "Promote", text: `Level up one Eddy worth ${2 ** PROMOTE_MAX} or less.`,
    flavor: "Congrats on the new role!" },
  row: { kind: "aim", aim: "row", icon: "❄", name: "Freeze row", text: `Lock a row for the next ${LOCK_CARDS} cards.`,
    flavor: "Out of office" },
  col: { kind: "aim", aim: "col", icon: "❄", name: "Freeze column", text: `Lock a column for the next ${LOCK_CARDS} cards.`,
    flavor: "Out of office" },
});

const STARTER = ["s0", "s1", "s2", "s3", "s0", "s1", "s2", "s3", "s0", "s1", "s2", "s3", "wild", "swap"];
// Cards offered when you reach a new top Eddy.
export const POOL = ["d0", "d1", "d2", "d3", "wild", "swap", "fire", "promote", "row", "col"];

export const card = type => ({ id: newId(), type });

export function shuffle(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newDeck(rand = Math.random) {
  return drawUp({ draw: shuffle(STARTER.map(card), rand), hand: [], discard: [] }, rand);
}

// Fill the hand back up, shuffling the discard pile into a new draw pile when it runs out.
export function drawUp(deck, rand = Math.random) {
  let { draw, hand, discard } = deck;
  draw = [...draw]; hand = [...hand];
  while (hand.length < HAND) {
    if (!draw.length) {
      if (!discard.length) break;
      draw = shuffle(discard, rand); discard = [];
    }
    hand.push(draw.pop());
  }
  return { draw, hand, discard };
}

export function playFromHand(deck, id, rand = Math.random) {
  const played = deck.hand.find(c => c.id === id);
  if (!played) return deck;
  return drawUp({ draw: deck.draw, hand: deck.hand.filter(c => c !== played), discard: [...deck.discard, played] }, rand);
}

export function mulligan(deck, rand = Math.random) {
  return drawUp({ draw: deck.draw, hand: [], discard: [...deck.discard, ...deck.hand] }, rand);
}

// A new card goes into the discard pile, so it comes round at the next shuffle.
export const addCard = (deck, type) => ({ ...deck, discard: [...deck.discard, card(type)] });

export const allCards = deck => [...deck.draw, ...deck.hand, ...deck.discard];

export function draftOptions(rand = Math.random, n = 3) {
  return shuffle(POOL, rand).slice(0, n);
}

// ---- locks ----
export const isLocked = (locks, r, c) => locks.some(l => (l.kind === "row" ? l.i === r : l.i === c));

export function addLock(locks, kind, i) {
  return [...locks.filter(l => !(l.kind === kind && l.i === i)), { kind, i, left: LOCK_CARDS }];
}

// One card has been played: every lock gets one card closer to melting.
export const tickLocks = locks => locks.map(l => ({ ...l, left: l.left - 1 })).filter(l => l.left > 0);

// ---- board ----
// Like the shared engine's slide, but locked cells are walls: their tiles stay put and never merge.
export function slideLocked(tiles, dir, locks = []) {
  const [dr, dc] = VECTORS[dir];
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t };

  const order = [...Array(SIZE).keys()];
  const rows = dr === 1 ? [...order].reverse() : order;
  const cols = dc === 1 ? [...order].reverse() : order;
  const mergedInto = new Set();
  const consumed = [];
  let moved = false, gained = 0;

  for (const r of rows) for (const c of cols) {
    const t = grid[r][c];
    if (!t || isLocked(locks, r, c)) continue;
    let nr = r, nc = c;
    for (;;) {
      const tr = nr + dr, tc = nc + dc;
      if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE || isLocked(locks, tr, tc)) break;
      const other = grid[tr][tc];
      if (!other) { nr = tr; nc = tc; continue; }
      if (other.lvl === t.lvl && t.lvl < MAX && !mergedInto.has(other.id)) {
        grid[r][c] = null;
        consumed.push({ ...t, r: tr, c: tc }, { ...other });
        const merged = { id: newId(), lvl: t.lvl + 1, r: tr, c: tc, merged: true };
        grid[tr][tc] = merged;
        mergedInto.add(merged.id);
        gained += 2 ** merged.lvl;
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
  return { tiles: out, consumed, moved, gained };
}

// Slide `times` times in a row, adding up merges and points.
export function slideTimes(tiles, dir, times, locks = []) {
  let res = { tiles, consumed: [], moved: false, gained: 0 };
  for (let i = 0; i < times; i++) {
    const next = slideLocked(res.tiles, dir, locks);
    if (!next.moved) break;
    res = { tiles: next.tiles, consumed: [...res.consumed, ...next.consumed], moved: true, gained: res.gained + next.gained };
  }
  return res;
}

// New Eddys never land in a locked cell.
export function spawnFree(tiles, locks = [], rand = Math.random) {
  const taken = new Set(tiles.map(t => t.r * SIZE + t.c));
  const cells = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!taken.has(r * SIZE + c) && !isLocked(locks, r, c)) cells.push([r, c]);
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  return { id: newId(), lvl: rand() < 0.9 ? 1 : 2, r, c };
}

// Which tiles a targeting card may pick.
export function canTarget(type, t, locks) {
  if (isLocked(locks, t.r, t.c)) return false;
  return type !== "promote" || t.lvl <= PROMOTE_MAX;
}

// Whether playing this card right now would do anything.
export function cardWorks(type, tiles, locks = []) {
  const def = CARDS[type];
  if (def.kind === "slide") return slideLocked(tiles, def.dir, locks).moved;
  if (def.aim === "dir") return [0, 1, 2, 3].some(d => slideLocked(tiles, d, locks).moved);
  if (def.aim === "row" || def.aim === "col") return true;
  const targets = tiles.filter(t => canTarget(type, t, locks)).length;
  return def.aim === "two" ? targets >= 2 : targets >= 1;
}

export function swap(tiles, a, b) {
  return tiles.map(t => (t.id === a.id ? { ...t, r: b.r, c: b.c } : t.id === b.id ? { ...t, r: a.r, c: a.c } : t));
}

export const promote = (tiles, id) => tiles.map(t => (t.id === id ? { ...t, lvl: t.lvl + 1, merged: true } : t));

export const topLevel = tiles => tiles.reduce((m, t) => Math.max(m, t.lvl), 0);

// Out of moves: the board is full with no matching neighbours, and no card left anywhere in the deck
// can break the jam. Mulligans reach every card in time, and locks melt as cards are played.
export function stuck(tiles, deck) {
  if (canMove(tiles, SIZE, MAX)) return false;
  const types = new Set(allCards(deck).map(c => c.type));
  if (types.has("fire")) return false;
  const helps = next => canMove(next, SIZE, MAX);
  if (types.has("promote") && tiles.some(t => t.lvl <= PROMOTE_MAX && helps(promote(tiles, t.id)))) return false;
  if (types.has("swap"))
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++)
        if (helps(swap(tiles, tiles[i], tiles[j]))) return false;
  return true;
}
