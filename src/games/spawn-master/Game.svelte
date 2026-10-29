<script>
  // Spawn Master: the bot slides, you choose where each new Eddy drops. The bot's moves are
  // fixed (see bot.js), so the game is about planning drops around them.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { emptyCells, newId, spawn } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { botTurn, ORDER } from "./bot.js";

  const SIZE = 4, MAX = 11, KEY = "spawn-master-v1", BOT_DELAY = 300;
  const ARROWS = ["↑", "→", "↓", "←"];

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let nextLvl = $state(1);
  let botIdx = $state(0);
  let busy = $state(false);
  let status = $state("Tap an empty square to drop the next Eddy.");
  let cursor = $state(null); // [r, c] when playing with the keyboard
  let photos = $state({});

  const live = () => tiles.filter(t => !t.gone);
  const open = $derived(over || (won && !keepGoing) ? [] : emptyCells(live(), SIZE));
  const plan = $derived([0, 1, 2, 3].map(i => (botIdx + i) % 4));
  const rollNext = () => (nextLvl = Math.random() < 0.9 ? 1 : 2);

  function newGame() {
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false; botIdx = 0; busy = false; cursor = null;
    status = "Tap an empty square to drop the next Eddy.";
    rollNext();
    persist();
  }

  function drop(r, c) {
    if (busy || over || (won && !keepGoing)) return;
    if (live().some(t => t.r === r && t.c === c)) return;
    tiles = [...live().map(t => ({ ...t, isNew: false, merged: false })), { id: newId(), lvl: nextLvl, r, c, isNew: true }];
    busy = true;
    setTimeout(bot, BOT_DELAY);
  }

  function bot() {
    const res = botTurn(live().map(({ id, lvl, r, c }) => ({ id, lvl, r, c })), SIZE, botIdx, MAX);
    busy = false;
    rollNext();
    if (res.dir === null) {
      over = true;
      status = "No slide moves anything.";
      persist();
      return;
    }
    tiles = [...res.tiles, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    botIdx = res.next;
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    const skipped = res.skipped.map(d => ORDER[d]);
    status = skipped.length
      ? `The bot couldn't slide ${skipped.join(" or ")}, so it slid ${ORDER[res.dir]}.`
      : `The bot slid ${ORDER[res.dir]}.`;
    if (cursor && !open.some(([r, c]) => r === cursor[0] && c === cursor[1])) cursor = open[0] ?? null;
    persist();
  }

  function persist() {
    save(KEY, { tiles: live().map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over, nextLvl, botIdx });
  }

  // Keyboard: arrows or WASD move a cursor over the board, Enter or Space drops there.
  const MOVES = { ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowDown: [1, 0], ArrowLeft: [0, -1],
    w: [-1, 0], d: [0, 1], s: [1, 0], a: [0, -1] };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("button, a, input, textarea")) return;
    const step = MOVES[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (step) {
      e.preventDefault();
      if (!cursor) cursor = open[0] ?? [0, 0];
      else cursor = [Math.min(SIZE - 1, Math.max(0, cursor[0] + step[0])), Math.min(SIZE - 1, Math.max(0, cursor[1] + step[1]))];
    } else if ((e.key === "Enter" || e.key === " ") && cursor) {
      e.preventDefault();
      drop(cursor[0], cursor[1]);
    }
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
    nextLvl = saved.nextLvl || 1;
    botIdx = (saved.botIdx || 0) % 4;
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

<GameHeader title="Spawn Master" {score} {best} onnew={newGame}>
  {#snippet goal()}The bot slides. You pick where each Eddy lands. Get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="plan">
  <div class="box">
    <span class="label">Next</span>
    <div class="next">{@render face(nextLvl)}</div>
  </div>
  <div class="box">
    <span class="label">Bot slides</span>
    <div class="arrows">
      {#each plan as d, i}
        <span class="arrow" class:now={i === 0} title={ORDER[d]}>{ARROWS[d]}</span>
      {/each}
    </div>
  </div>
</div>

<Board size={SIZE} {tiles} keys={false}>
  {#snippet tile(t)}{@render face(t.lvl)}{/snippet}
  {#snippet overlay()}
    {#each open as [r, c] (r * SIZE + c)}
      <button
        class="target"
        class:busy
        class:cursor={cursor && cursor[0] === r && cursor[1] === c}
        style="--r: {r}; --c: {c}"
        aria-label="Drop the next Eddy at row {r + 1}, column {c + 1}"
        onclick={() => drop(r, c)}
      >
        <span class="ghost">{@render face(nextLvl)}</span>
      </button>
    {/each}
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
</Board>

<p class="status" aria-live="polite">{status}</p>

<p class="how">
  <strong>How to play:</strong> Tap an empty square to drop the next Eddy there, or move with the arrow keys and press
  Enter. Then the bot slides. It always slides in the order up, right, down, left, and skips any slide that wouldn't
  move anything. Plan your drops so its slides line up merges. The game ends when no slide moves anything.
</p>

<style>
  .plan { display: flex; gap: 8px; justify-content: space-between; margin-bottom: 12px; }
  .box {
    background: var(--board); border-radius: 3px; padding: 6px 12px 8px; display: flex; flex-direction: column;
    align-items: center; gap: 4px;
  }
  .label { color: var(--box-label); font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
  .next { width: 44px; height: 44px; border-radius: 3px; overflow: hidden; container-type: inline-size; }
  .next .num { font-size: 40cqw; }
  .next .final { font-size: 20cqw; }
  .arrows { display: flex; gap: 5px; }
  .arrow {
    width: 44px; height: 44px; display: grid; place-items: center; border-radius: 3px;
    background: var(--cell); color: var(--light-text); font-size: 24px; font-weight: bold;
  }
  .arrow.now { background: var(--t4); }

  .target {
    position: absolute; z-index: 30; padding: 0; border: 0; border-radius: 3px; background: transparent; cursor: pointer;
    width: var(--cell-size); height: var(--cell-size);
    left: calc(var(--gap) + var(--c) * (var(--cell-size) + var(--gap)));
    top: calc(var(--gap) + var(--r) * (var(--cell-size) + var(--gap)));
  }
  .ghost { display: block; width: 100%; height: 100%; border-radius: 3px; overflow: hidden; opacity: 0; transition: opacity 80ms; }
  .target:hover .ghost, .target.cursor .ghost, .target:focus-visible .ghost { opacity: 0.5; }
  .target.cursor { outline: 3px solid var(--t6); outline-offset: 2px; }
  .target.busy { cursor: default; pointer-events: none; }
  .target.busy .ghost { opacity: 0; }

  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 11cqw; line-height: 1; }
  .num.d3 { font-size: 9cqw; }
  .num.d4 { font-size: 7cqw; }
  .final { font-size: 5.4cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 3.6cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 4px; bottom: 4px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 2.6cqw;
  }
  .status { margin: 14px 0 0; min-height: 1.4em; text-align: center; font-weight: bold; }
  .how { margin-top: 20px; line-height: 1.5; }
</style>
