import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HAND, CARDS, slideLocked, slideTimes, spawnFree, cardWorks, newDeck, drawUp, playFromHand, mulligan,
  addCard, allCards, addLock, tickLocks, swap, promote, stuck, draftOptions, card,
} from "./logic.js";

const tile = (lvl, r, c, id = r * 10 + c + 100) => ({ id, lvl, r, c });
const at = tiles => tiles.map(t => `${t.lvl}@${t.r},${t.c}`).sort().join(" ");
const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

test("a plain slide merges like classic 2048", () => {
  const res = slideLocked([tile(1, 0, 0), tile(1, 0, 3)], LEFT);
  assert.equal(at(res.tiles), "2@0,0");
  assert.equal(res.gained, 4);
});

test("a locked row stays put and blocks tiles sliding into it", () => {
  const locks = addLock([], "row", 1);
  const res = slideLocked([tile(1, 3, 0), tile(1, 1, 0), tile(2, 1, 3)], UP, locks);
  assert.equal(at(res.tiles), "1@1,0 1@2,0 2@1,3");
  assert.equal(res.gained, 0);
});

test("locked tiles do not slide along their own row either", () => {
  const locks = addLock([], "row", 0);
  assert.equal(slideLocked([tile(1, 0, 3)], LEFT, locks).moved, false);
});

test("a ×2 card slides twice and adds up the points", () => {
  const res = slideTimes([tile(1, 0, 0), tile(1, 0, 1), tile(2, 0, 3)], LEFT, 2);
  assert.equal(at(res.tiles), "3@0,0");
  assert.equal(res.gained, 4 + 8);
});

test("new Eddys never spawn in a locked cell", () => {
  const locks = addLock(addLock(addLock([], "row", 0), "row", 1), "row", 2);
  for (let i = 0; i < 50; i++) assert.equal(spawnFree([], locks).r, 3);
  const full = addLock(locks, "row", 3);
  assert.equal(spawnFree([], full), null);
});

test("locks melt after three cards", () => {
  let locks = addLock([], "col", 2);
  locks = tickLocks(tickLocks(locks));
  assert.equal(locks.length, 1);
  assert.equal(tickLocks(locks).length, 0);
});

test("the starting hand is full and the deck holds 14 cards", () => {
  const deck = newDeck();
  assert.equal(deck.hand.length, HAND);
  assert.equal(allCards(deck).length, 14);
});

test("playing a card discards it and draws a replacement", () => {
  const deck = newDeck();
  const played = deck.hand[0];
  const next = playFromHand(deck, played.id);
  assert.equal(next.hand.length, HAND);
  assert.ok(next.discard.includes(played));
  assert.equal(allCards(next).length, 14);
});

test("an empty draw pile reshuffles the discards", () => {
  const deck = drawUp({ draw: [], hand: [], discard: ["s0", "s1", "s2", "s3", "wild", "swap"].map(card) });
  assert.equal(deck.hand.length, HAND);
  assert.equal(deck.draw.length, 1);
  assert.equal(deck.discard.length, 0);
});

test("a mulligan swaps the whole hand", () => {
  const deck = newDeck();
  const next = mulligan(deck);
  assert.equal(next.hand.length, HAND);
  assert.ok(deck.hand.every(c => !next.hand.includes(c)));
});

test("drafted cards join the discard pile", () => {
  const deck = addCard(newDeck(), "fire");
  assert.equal(deck.discard.at(-1).type, "fire");
  const opts = draftOptions();
  assert.equal(new Set(opts).size, 3);
  assert.ok(opts.every(t => CARDS[t]));
});

test("cardWorks knows when a slide would do nothing", () => {
  const tiles = [tile(1, 0, 0)];
  assert.equal(cardWorks("s0", tiles), false);
  assert.equal(cardWorks("s2", tiles), true);
  assert.equal(cardWorks("swap", tiles), false);
  assert.equal(cardWorks("fire", tiles), true);
  assert.equal(cardWorks("promote", [tile(6, 0, 0)]), false);
});

test("swap and promote", () => {
  const a = tile(1, 0, 0), b = tile(3, 2, 2);
  assert.equal(at(swap([a, b], a, b)), "1@2,2 3@0,0");
  assert.equal(at(promote([a, b], a.id)), "2@0,0 3@2,2");
});

// A full board with no matching neighbours: a checkerboard of 1s and 2s.
const jammed = () => {
  const out = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push(tile((r + c) % 2 ? 2 : 1, r, c));
  return out;
};

test("a jammed board is game over only when no card can help", () => {
  const plain = { draw: [], hand: ["s0", "s1", "s2", "s3"].map(card), discard: [] };
  assert.equal(stuck(jammed(), plain), true);
  assert.equal(stuck(jammed(), addCard(plain, "fire")), false);
  assert.equal(stuck(jammed(), addCard(plain, "promote")), false);
  assert.equal(stuck(jammed(), addCard(plain, "swap")), false);
});
