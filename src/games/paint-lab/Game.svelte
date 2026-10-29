<script>
  // Paint Lab: tiles are paints. Same color deepens, two primaries mix, opposite colors cancel.
  // The rules live in rules.js; this file draws them with the shared header, board and overlay.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { HUES, MAX, slide, spawn, canMove, paint } from "./rules.js";

  const SIZE = 4, KEY = "paint-lab-v1";

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);

  function newGame() {
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const live = tiles.filter(t => !t.gone).map(({ id, hue, lvl, r, c }) => ({ id, hue, lvl, r, c }));
    const res = slide(live, SIZE, dir);
    if (!res.moved) return;
    const next = res.tiles;
    // A clean board after a cancel gets two fresh paints, like a new game.
    for (let i = next.length ? 1 : 2; i > 0; i--) {
      const extra = spawn(next, SIZE);
      if (extra) next.push({ ...extra, isNew: true });
    }
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE)) over = true;
    persist();
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ hue, lvl, r, c }) => ({ hue, lvl, r, c })), score, won, keepGoing, over });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
  } else {
    newGame();
  }

  const value = lvl => 2 ** lvl;
  const swatch = (hue, lvl = 3) => paint(hue, lvl).bg;
</script>

<GameHeader title="Paint Lab" {score} {best} onnew={newGame}>
  {#snippet goal()}Mix your paints and make a <strong>level {MAX} shade!</strong>{/snippet}
</GameHeader>

<Board size={SIZE} {tiles} onmove={move}>
  {#snippet tile(t)}
    {@const p = paint(t.hue, t.lvl)}
    <div class="face" class:dark={p.dark} style="background: {p.bg}" aria-label="{HUES[t.hue]} level {t.lvl}">
      <span class="num" class:d3={value(t.lvl) >= 100}>{value(t.lvl)}</span>
      <span class="hue">{HUES[t.hue]}</span>
    </div>
  {/snippet}
  {#snippet overlay()}
    {#if won && !keepGoing}
      <Overlay title="Masterpiece!" won>
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

<div class="chart">
  <div class="col">
    <h2>Mix</h2>
    {#each [[0, 2, 1], [2, 4, 3], [4, 0, 5]] as [a, b, out]}
      <div class="rule">
        <i style="background: {swatch(a)}"></i>+<i style="background: {swatch(b)}"></i>=<i style="background: {swatch(out)}"></i>
        <span>{HUES[a]} + {HUES[b]} = {HUES[out]}</span>
      </div>
    {/each}
  </div>
  <div class="col">
    <h2>Cancel</h2>
    {#each [[0, 3], [2, 5], [4, 1]] as [a, b]}
      <div class="rule">
        <i style="background: {swatch(a)}"></i>&times;<i style="background: {swatch(b)}"></i>
        <span>{HUES[a]} and {HUES[b]} wipe out</span>
      </div>
    {/each}
  </div>
</div>

<p class="how">
  <strong>How to play:</strong> Use your arrow keys, or swipe, to move the tiles. New paints are always red,
  yellow or blue. Only tiles with the same number react: two of the same color merge into a deeper shade, two
  different primaries mix into the color between them, and opposite colors cancel out for bonus points.
</p>

<style>
  .face {
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 10cqw; line-height: 1; }
  .num.d3 { font-size: 8.5cqw; }
  .hue { font-size: 2.6cqw; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85; margin-top: 0.6cqw; }

  .chart {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; padding: 12px 14px;
    background: var(--board); border-radius: 6px; color: var(--light-text);
  }
  h2 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--box-label); }
  .rule { display: flex; align-items: center; gap: 4px; font-weight: bold; margin-top: 6px; }
  .rule i { display: inline-block; width: 22px; height: 22px; border-radius: 3px; flex-shrink: 0; }
  .rule span { font-size: 13px; font-weight: normal; margin-left: 6px; line-height: 1.2; }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 520px) {
    .chart { grid-template-columns: 1fr; }
  }
</style>
