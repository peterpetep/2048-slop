<script>
  // Conveyor: classic slide-and-merge on a 4-wide, 5-tall board. Every few moves the whole board
  // shifts up a row and a new row of Eddys enters from the bottom. A tile pushed off the top ends the game.
  import { tick } from "svelte";
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { slide, spawn, canMove, makeRow, interval, push } from "./logic.js";

  const ROWS = 5, COLS = 4, MAX = 11, KEY = "conveyor-v1";

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false); // false, "top" or "stuck"
  let pushes = $state(0);
  let movesLeft = $state(5);
  let nextRow = $state([]);
  let pushing = $state(false); // input is locked until the belt finishes
  let belting = $state(false); // tiles use the slower belt transition
  let photos = $state({});

  const live = () => tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
  const topFull = $derived(tiles.some(t => !t.gone && t.r === 0));

  function newGame() {
    pushing = false; belting = false;
    const start = [];
    makeRow(COLS).forEach((lvl, c) => { if (lvl) start.push({ id: newId(), lvl, r: ROWS - 1, c, isNew: true }); });
    start.push({ ...spawn(start, ROWS, COLS), isNew: true });
    tiles = start;
    score = 0; won = false; keepGoing = false; over = false;
    pushes = 0; movesLeft = interval(0); nextRow = makeRow(COLS);
    persist();
  }

  function move(dir) {
    if (pushing || over || (won && !keepGoing)) return;
    const res = slide(live(), ROWS, COLS, dir, MAX);
    if (!res.moved) return;
    const next = res.tiles;
    movesLeft--;
    if (movesLeft > 0) {
      const extra = spawn(next, ROWS, COLS);
      if (extra) next.push({ ...extra, isNew: true });
    }
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (movesLeft > 0) {
      if (!canMove(next, ROWS, COLS, MAX)) over = "stuck";
      persist();
      return;
    }
    // The belt runs once the slide has finished animating.
    pushing = true;
    setTimeout(runBelt, 140);
  }

  async function runBelt() {
    if (!pushing) return; // a new game started meanwhile
    const res = push(live(), ROWS, nextRow);
    if (res.toppedOut) {
      over = "top"; pushing = false; persist();
      return;
    }
    // Entering tiles start one row below the board, then slide up into place with everything else.
    belting = true;
    tiles = res.tiles.map(t => (t.entering ? { ...t, r: ROWS } : t));
    pushes++; movesLeft = interval(pushes); nextRow = makeRow(COLS);
    await tick();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      tiles = tiles.map(t => (t.entering ? { id: t.id, lvl: t.lvl, r: ROWS - 1, c: t.c } : t));
      pushing = false;
      setTimeout(() => (belting = false), 240);
      if (!canMove(live(), ROWS, COLS, MAX)) over = "stuck";
      persist();
    }));
  }

  function persist() {
    save(KEY, { tiles: live().map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over, pushes, movesLeft, nextRow });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length && saved.nextRow?.length === COLS) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over, pushes, movesLeft, nextRow } = saved);
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

  // ---- input: arrow keys, WASD and swipe, same as the shared Board ----
  const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir === undefined || e.target.closest?.("input, textarea")) return;
    e.preventDefault();
    move(dir);
  }
  let start = null;
  function down(e) { start = [e.clientX, e.clientY]; }
  function up(e) {
    if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1];
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  }
</script>

<svelte:window {onkeydown} />

{#snippet face(lvl)}
  <div class="face" class:dark={lvl <= 2} style="background: var(--t{lvl})">
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

<GameHeader title="Conveyor" {score} {best} onnew={newGame}>
  {#snippet goal()}Get to <strong>Eddy Li (MIT)</strong> before the belt buries you!{/snippet}
</GameHeader>

<div class="belt" class:soon={movesLeft === 1}>
  <span class="label">{movesLeft <= 1 ? "New row on your next move" : `New row in ${movesLeft} moves`}</span>
  <span class="pips" aria-hidden="true">
    {#each { length: interval(pushes) } as _, i}<span class="pip" class:on={i < movesLeft}></span>{/each}
  </span>
</div>

<div class="board" class:danger={topFull && !over} onpointerdown={down} onpointerup={up} onpointercancel={() => (start = null)}>
  {#each { length: ROWS * COLS } as _, i}
    <div class="cell" class:top={i < COLS} style="--r: {Math.floor(i / COLS)}; --c: {i % COLS}"></div>
  {/each}
  {#each tiles as t (t.id)}
    <div class="tile" class:new={t.isNew} class:merged={t.merged} class:gone={t.gone} class:belt={belting}
      style="--r: {t.r}; --c: {t.c}">
      <div class="inner">{@render face(t.lvl)}</div>
    </div>
  {/each}
  {#if won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if over}
    <Overlay title={over === "top" ? "Topped out!" : "Game over!"}>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {/if}
</div>

<div class="incoming">
  <span class="label">Coming up</span>
  <div class="row">
    {#each nextRow as lvl}
      <div class="slot">{#if lvl}{@render face(lvl)}{/if}</div>
    {/each}
  </div>
</div>

<p class="how">
  <strong>How to play:</strong> Use your arrow keys, or swipe, to move the tiles. When two tiles with the same Eddy
  touch, they merge into the next one. Every few moves the board shifts up and the row shown under it slides in from
  the bottom. If an Eddy is in the top row when that happens, you lose. Rows come faster as you go.
</p>

<style>
  /* Board: 4 columns, 5 rows of square cells. Sizes use cqw so the gap is the same across and down. */
  .board {
    --gap: 3cqw;
    --cell-size: calc((100cqw - 5 * var(--gap)) / 4);
    position: relative; width: 100%; max-width: 440px; aspect-ratio: 400 / 497; margin: 0 auto;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    container-type: inline-size; overflow: hidden;
  }
  .cell, .tile {
    position: absolute; width: var(--cell-size); height: var(--cell-size);
    left: calc(var(--gap) + var(--c) * (var(--cell-size) + var(--gap)));
    top: calc(var(--gap) + var(--r) * (var(--cell-size) + var(--gap)));
  }
  .cell { background: var(--cell); border-radius: 3px; transition: box-shadow 150ms; }
  .board.danger .cell.top { box-shadow: inset 0 0 0 3px var(--t6); }
  .tile { z-index: 10; transition: left 100ms ease-in-out, top 100ms ease-in-out; }
  .tile.belt { transition: top 220ms cubic-bezier(.3, .7, .4, 1); }
  .tile.merged { z-index: 20; }
  .tile.gone { z-index: 5; }
  .inner { width: 100%; height: 100%; border-radius: 3px; overflow: hidden; }
  .tile.new .inner { animation: appear 200ms ease 100ms backwards; }
  .tile.merged .inner { animation: pop 200ms ease 100ms backwards; }
  @keyframes appear { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
  @keyframes pop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }

  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center; container-type: inline-size;
  }
  .face.dark { color: var(--text); }
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

  /* countdown above the board: one pip per move until the next row */
  .belt {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    max-width: 440px; margin: 0 auto 10px; font-size: 15px; font-weight: bold;
  }
  .pips { display: flex; gap: 5px; }
  .pip { width: 16px; height: 16px; border-radius: 3px; background: var(--cell); box-shadow: inset 0 0 0 2px var(--board); }
  .pip.on { background: var(--t4); box-shadow: none; }
  .belt.soon .pip.on { background: var(--t6); }
  .belt.soon .label { color: var(--t6); }

  /* the queued row, under the board */
  .incoming { max-width: 440px; margin: 10px auto 0; background: var(--board); border-radius: 6px; padding: 8px 12px; }
  .incoming .label { display: block; color: var(--box-label); font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
  .row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .slot { aspect-ratio: 2 / 1; background: var(--cell); border-radius: 3px; overflow: hidden; }
  .slot .face { container-type: size; }
  .slot .num { font-size: 50cqh; }
  .slot .final { font-size: 26cqh; }

  .how { margin-top: 28px; line-height: 1.5; }

  @media (prefers-reduced-motion: reduce) {
    .tile, .tile.belt { transition: none; }
    .tile .inner { animation: none !important; }
  }
</style>
