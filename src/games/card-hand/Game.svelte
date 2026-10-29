<script>
  // Card Hand: classic 2048, except every move is a card. You hold five cards drawn from a deck
  // (slides, plus tricks like Swap and Freeze row). Each new top Eddy lets you add a card to the deck.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { newId } from "../../lib/engine.js";
  import {
    SIZE, MAX, CARDS, card, newDeck, playFromHand, mulligan, addCard, draftOptions, addLock, tickLocks,
    isLocked, slideTimes, spawnFree, canTarget, cardWorks, swap, promote, topLevel, stuck,
  } from "./logic.js";

  const KEY = "card-hand-v1";

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let deck = $state({ draw: [], hand: [], discard: [] });
  let locks = $state([]); // [{ kind: "row" | "col", i, left }]
  let peak = $state(0); // highest level reached this game
  let drafts = $state(0); // card picks still owed
  let offer = $state([]); // card types on offer for the current pick
  let aiming = $state(null); // { card, picked: [tile] } while a card waits for a target
  let photos = $state({});

  const live = () => tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
  const liveTiles = $derived(tiles.filter(t => !t.gone));
  const blocked = $derived(over || (won && !keepGoing) || offer.length > 0);

  function newGame() {
    const first = spawnFree([], []);
    tiles = [{ ...first, isNew: true }, { ...spawnFree([first], []), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    deck = newDeck(); locks = []; peak = topLevel(tiles); drafts = 0; offer = []; aiming = null;
    persist();
  }

  // Play a card from the hand. `arg` is its target: a direction, a tile, two tiles, or a row/column index.
  function play(c, arg) {
    if (blocked) return;
    const def = CARDS[c.type];
    let next = live(), consumed = [], gained = 0, slid = false;
    let nextLocks = tickLocks(locks);
    if (def.kind === "slide" || def.aim === "dir") {
      const res = slideTimes(next, def.kind === "slide" ? def.dir : arg, def.times ?? 1, locks);
      if (!res.moved) return;
      ({ tiles: next, consumed, gained } = res);
      slid = true;
    } else if (def.aim === "two") next = swap(next, arg[0], arg[1]);
    else if (c.type === "fire") { next = next.filter(t => t.id !== arg.id); consumed = [arg]; }
    else if (c.type === "promote") next = promote(next, arg.id);
    else nextLocks = addLock(nextLocks, def.aim, arg);
    locks = nextLocks;
    // Only slides bring in a new Eddy; trick cards are free.
    if (slid) {
      const extra = spawnFree(next, locks);
      if (extra) next.push({ ...extra, isNew: true });
    }
    deck = playFromHand(deck, c.id);
    aiming = null;
    finish(next, consumed, gained);
  }

  // Throw the whole hand away and draw a fresh one. It costs a turn: a new Eddy arrives.
  function redraw() {
    if (blocked) return;
    aiming = null;
    locks = tickLocks(locks);
    deck = mulligan(deck);
    const next = live();
    const extra = spawnFree(next, locks);
    if (extra) next.push({ ...extra, isNew: true });
    finish(next, [], 0);
  }

  function finish(next, consumed, gained) {
    tiles = [...next, ...consumed.map(t => ({ ...t, gone: true }))];
    if (consumed.length) setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    const top = topLevel(next);
    // Every new top Eddy from 8 up earns a card for the deck.
    while (peak < top) { peak++; if (peak >= 3 && peak < MAX) drafts++; }
    if (drafts && !offer.length) offer = draftOptions();
    if (top >= MAX && !won) won = true;
    checkStuck();
    persist();
  }

  // Wait for any pending pick, since the new card might be the one that saves the game.
  function checkStuck() {
    if (!offer.length && stuck(live(), deck)) over = true;
  }

  function pick(type) {
    if (type) deck = addCard(deck, type);
    drafts--;
    offer = drafts > 0 ? draftOptions() : [];
    checkStuck();
    persist();
  }

  function choose(c) {
    if (blocked || !cardWorks(c.type, liveTiles, locks)) return;
    if (aiming?.card.id === c.id) { aiming = null; return; }
    if (CARDS[c.type].kind === "slide") play(c);
    else aiming = { card: c, picked: [] };
  }

  // Arrow keys and swipes: aim an Any way card, or play a matching slide card from the hand.
  function playDir(dir) {
    if (blocked) return;
    if (aiming) {
      if (CARDS[aiming.card.type].aim === "dir") play(aiming.card, dir);
      return;
    }
    const works = c => cardWorks(c.type, liveTiles, locks);
    const c = deck.hand.find(c => c.type === `s${dir}` && works(c))
      ?? deck.hand.find(c => c.type === `d${dir}` && works(c))
      ?? deck.hand.find(c => c.type === "wild" && works(c));
    if (c) play(c, dir);
  }

  function pickTile(t) {
    if (!aiming || !canTarget(aiming.card.type, t, locks)) return;
    if (CARDS[aiming.card.type].aim === "tile") return play(aiming.card, t);
    const picked = aiming.picked.some(p => p.id === t.id)
      ? aiming.picked.filter(p => p.id !== t.id)
      : [...aiming.picked, t];
    if (picked.length === 2) play(aiming.card, picked);
    else aiming = { ...aiming, picked };
  }

  const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea")) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "Escape" && aiming) { aiming = null; e.preventDefault(); return; }
    const n = Number(key);
    if (n >= 1 && n <= 5) {
      if (offer.length) { if (offer[n - 1]) pick(offer[n - 1]); }
      else if (deck.hand[n - 1]) choose(deck.hand[n - 1]);
      e.preventDefault();
      return;
    }
    if (KEYS[key] !== undefined) { e.preventDefault(); playDir(KEYS[key]); }
  }

  function persist() {
    const types = list => list.map(c => c.type);
    save(KEY, {
      tiles: live().map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over,
      deck: { draw: types(deck.draw), hand: types(deck.hand), discard: types(deck.discard) },
      locks, peak, drafts, offer,
    });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length && saved.deck?.hand?.every(t => CARDS[t])) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    const cards = list => (list ?? []).filter(t => CARDS[t]).map(card);
    deck = { draw: cards(saved.deck.draw), hand: cards(saved.deck.hand), discard: cards(saved.deck.discard) };
    score = saved.score ?? 0; won = !!saved.won; keepGoing = !!saved.keepGoing; over = !!saved.over;
    locks = saved.locks ?? []; peak = saved.peak ?? 0; drafts = saved.drafts ?? 0; offer = saved.offer ?? [];
  } else {
    newGame();
  }

  // Look for a photo for each level in public/photos.
  for (let lvl = 1; lvl <= MAX; lvl++) {
    const exts = ["jpg", "png", "webp"];
    const tryNext = () => {
      if (!exts.length) return;
      const src = `${import.meta.env.BASE_URL}photos/eddy-${lvl}.${exts.shift()}`;
      const img = new Image();
      img.onload = () => (photos[lvl] = src);
      img.onerror = tryNext;
      img.src = src;
    };
    tryNext();
  }

  const value = lvl => 2 ** lvl;
  const aim = $derived(aiming ? CARDS[aiming.card.type].aim : null);
  const PROMPTS = {
    dir: "Pick a direction, with the arrows or a swipe.",
    two: "Tap two Eddys to swap.",
    tile: "Tap an Eddy.",
    row: "Tap a row to freeze.",
    col: "Tap a column to freeze.",
  };
</script>

<svelte:window {onkeydown} />

{#snippet face(t)}
  {@const lvl = t.lvl}
  <div class="face" class:dark={lvl <= 2} class:picked={aiming?.picked.some(p => p.id === t.id)}
    style="background: var(--t{Math.min(lvl, MAX)})">
    {#if photos[lvl]}
      <img src={photos[lvl]} alt={lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${lvl}`} draggable="false" />
      <span class="badge">{lvl === MAX ? "Eddy Li (MIT)" : value(lvl)}</span>
    {:else if lvl === MAX}
      <span class="final">Eddy Li<small>MIT</small></span>
    {:else}
      <span class="num" class:d3={value(lvl) >= 100} class:d4={value(lvl) >= 1000}>{value(lvl)}</span>
    {/if}
  </div>
{/snippet}

{#snippet layers()}
  {#each locks as l (l.kind + l.i)}
    <div class="lock {l.kind}" style="--i: {l.i}"><span>❄ {l.left}</span></div>
  {/each}
  {#if aim === "row" || aim === "col"}
    {#each { length: SIZE } as _, i}
      <button class="target {aim}" style="--i: {i}" aria-label="Freeze {aim} {i + 1}"
        onclick={() => play(aiming.card, i)}></button>
    {/each}
  {:else if aim === "tile" || aim === "two"}
    {#each liveTiles as t (t.id)}
      {#if canTarget(aiming.card.type, t, locks)}
        <button class="target cell" class:on={aiming.picked.some(p => p.id === t.id)} style="--r: {t.r}; --c: {t.c}"
          aria-label="Eddy worth {value(t.lvl)}" onclick={() => pickTile(t)}></button>
      {/if}
    {/each}
  {/if}
  {#if won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if over}
    <Overlay title="Game over!">
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {/if}
{/snippet}

{#snippet cardFace(type, flavor = false)}
  {@const def = CARDS[type]}
  <span class="icon">{def.icon}</span>
  <span class="name">{def.name}</span>
  <span class="text">{def.text}</span>
  {#if flavor && def.flavor}<span class="flavor">“{def.flavor}”</span>{/if}
{/snippet}

<GameHeader title="Card Hand" {score} {best} onnew={newGame}>
  {#snippet goal()}Play your cards right to reach <strong>Eddy Li (MIT)</strong>!{/snippet}
</GameHeader>

<Board size={SIZE} {tiles} tile={face} overlay={layers} onmove={playDir} keys={false} />

{#if offer.length}
  <section class="draft">
    <p class="bar"><strong>New top Eddy!</strong> Add a card to your deck.</p>
    <div class="hand three">
      {#each offer as type, i}
        <button class="card {CARDS[type].kind} {type}" onclick={() => pick(type)}>
          <span class="key">{i + 1}</span>
          {@render cardFace(type, true)}
        </button>
      {/each}
    </div>
    <button class="small" onclick={() => pick(null)}>Skip</button>
  </section>
{:else}
  <div class="bar">
    {#if aiming}
      <span><strong>{CARDS[aiming.card.type].name}:</strong> {PROMPTS[aim]}</span>
      <span class="actions">
        {#if aim === "dir"}
          {#each ["↑", "→", "↓", "←"] as arrow, dir}
            <button class="small" aria-label="Slide {['up', 'right', 'down', 'left'][dir]}"
              onclick={() => play(aiming.card, dir)}>{arrow}</button>
          {/each}
        {/if}
        <button class="small" onclick={() => (aiming = null)}>Cancel</button>
      </span>
    {:else}
      <span class="piles">Deck {deck.draw.length} · Played {deck.discard.length}</span>
      <button class="small" onclick={redraw} disabled={blocked}
        title="Discard your hand and draw five new cards. A new Eddy arrives.">Redraw hand</button>
    {/if}
  </div>
  <div class="hand">
    {#each deck.hand as c, i (c.id)}
      <button class="card {CARDS[c.type].kind} {c.type}" class:active={aiming?.card.id === c.id}
        disabled={blocked || !cardWorks(c.type, liveTiles, locks)} title={CARDS[c.type].text} onclick={() => choose(c)}>
        <span class="key">{i + 1}</span>
        {@render cardFace(c.type)}
      </button>
    {/each}
  </div>
{/if}

<p class="how">
  <strong>How to play:</strong> Every move is a card. Tap one (or press its number) to play it, or use the arrow keys
  and swipes to play a matching slide card from your hand. Slides bring in a new Eddy; tricks like Swap, Promote and
  Freeze don't. Greyed-out cards wouldn't do anything right now. Stuck? Redraw your hand, but a new Eddy arrives.
  Each time you make a new top Eddy, from 8 up, you pick a card to add to your deck.
</p>

<style>
  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center; container-type: inline-size;
  }
  .face.dark { color: var(--text); }
  .face.picked { box-shadow: inset 0 0 0 4px var(--t6); }
  .num { font-size: 44cqw; line-height: 1; }
  .num.d3 { font-size: 36cqw; }
  .num.d4 { font-size: 28cqw; }
  .final { font-size: 21cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 14cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 4px; bottom: 4px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 11cqw;
  }

  /* Layers drawn over the board reuse the Board's --gap and --cell-size. */
  .lock, .target { position: absolute; border: 0; padding: 0; border-radius: 3px; }
  .lock {
    z-index: 30; pointer-events: none; background: rgba(150, 200, 235, 0.35);
    box-shadow: inset 0 0 0 3px rgba(110, 170, 215, 0.9); display: flex; align-items: flex-start; justify-content: flex-end;
  }
  .lock span { background: rgba(110, 170, 215, 0.95); color: #fff; font-size: 13px; font-weight: bold; padding: 1px 6px; border-radius: 0 3px 0 3px; }
  .lock.row, .target.row {
    left: var(--gap); width: calc(100% - 2 * var(--gap)); height: var(--cell-size);
    top: calc(var(--gap) + var(--i) * (var(--cell-size) + var(--gap)));
  }
  .lock.col, .target.col {
    top: var(--gap); height: calc(100% - 2 * var(--gap)); width: var(--cell-size);
    left: calc(var(--gap) + var(--i) * (var(--cell-size) + var(--gap)));
  }
  .target { z-index: 40; cursor: pointer; background: transparent; box-shadow: inset 0 0 0 2px rgba(246, 94, 59, 0.45); }
  .target:hover, .target:focus-visible, .target.on { background: rgba(246, 94, 59, 0.2); box-shadow: inset 0 0 0 4px var(--t6); }
  .target.cell {
    width: var(--cell-size); height: var(--cell-size);
    left: calc(var(--gap) + var(--c) * (var(--cell-size) + var(--gap)));
    top: calc(var(--gap) + var(--r) * (var(--cell-size) + var(--gap)));
  }

  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    max-width: 500px; margin: 14px auto 8px; font-size: 15px; min-height: 32px;
  }
  .draft .bar { display: block; margin-bottom: 8px; }
  .piles { font-weight: bold; }
  .actions { display: flex; gap: 5px; }
  .small {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    height: 32px; min-width: 32px; padding: 0 12px; font-size: 15px; font-weight: bold; cursor: pointer;
  }
  .small:disabled { opacity: 0.5; cursor: default; }

  .hand { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; max-width: 500px; margin: 0 auto; }
  .hand.three { grid-template-columns: repeat(3, 1fr); }
  .card {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0;
    padding: 18px 5px 10px; border: 0; border-radius: 6px; cursor: pointer; text-align: center;
    background: var(--t2); color: var(--text); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
    transition: transform 100ms ease, opacity 150ms; animation: deal 220ms ease backwards;
  }
  .card:hover:not(:disabled) { transform: translateY(-4px); }
  .card.active { transform: translateY(-8px); box-shadow: 0 0 0 3px var(--t6), 0 3px 0 rgba(0, 0, 0, 0.15); }
  .card:disabled { opacity: 0.4; cursor: default; }
  .card.slide:is(.d0, .d1, .d2, .d3) { background: var(--t3); color: var(--light-text); }
  .card.aim { background: var(--t5); color: var(--light-text); }
  .card.aim:is(.row, .col) { background: #7fb2d8; }
  .card.aim.promote { background: var(--t9); }
  .key { position: absolute; top: 4px; left: 6px; font-size: 11px; font-weight: bold; opacity: 0.6; }
  .icon { font-size: 26px; line-height: 1; font-weight: bold; }
  .name { font-size: 14px; font-weight: bold; line-height: 1.15; }
  .text { font-size: 11px; line-height: 1.3; opacity: 0.9; }
  .flavor { font-size: 11px; font-style: italic; opacity: 0.85; }
  @keyframes deal { from { opacity: 0; transform: translateY(16px); } }
  .draft { max-width: 500px; margin: 0 auto; text-align: center; }
  .draft .small { margin-top: 8px; }

  .how { margin-top: 28px; line-height: 1.5; }

  @media (max-width: 520px) {
    .hand:not(.three) .text { display: none; }
    .card { padding: 16px 3px 8px; }
    .name { font-size: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; transition: none; }
  }
</style>
