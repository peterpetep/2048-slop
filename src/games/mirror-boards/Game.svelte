<script>
  // Mirror Boards: two Eddy boards share every move. The second board is flipped left to right, so a
  // swipe left slides it right. Points from both boards add up, and the game ends when either board jams.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { spawn, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { step } from "./logic.js";

  const SIZE = 4, MAX = 11, KEY = "mirror-boards-v1";
  const NAMES = ["Eddy board", "Mirror board"];

  let boards = $state([[], []]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let jammed = $state([false, false]);
  let photos = $state({});
  const over = $derived(jammed.some(Boolean));

  function fresh() {
    const first = spawn([], SIZE);
    return [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
  }

  function newGame() {
    boards = [fresh(), fresh()];
    score = 0; won = false; keepGoing = false; jammed = [false, false];
    persist();
  }

  const live = tiles => tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const out = step(boards.map(live), SIZE, dir, MAX);
    if (!out) return;
    boards = out.results.map((res, i) =>
      res.moved ? [...res.tiles, ...res.consumed.map(t => ({ ...t, gone: true }))] : boards[i]);
    setTimeout(() => (boards = boards.map(b => b.filter(t => !t.gone))), 120);
    score += out.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (out.topLvl === MAX && !won) won = true;
    jammed = out.jammed;
    persist();
  }

  function persist() {
    save(KEY, {
      boards: boards.map(b => b.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c }))),
      score, won, keepGoing, jammed,
    });
  }

  const saved = load(KEY);
  if (Array.isArray(saved?.boards) && saved.boards.length === 2 && saved.boards.every(b => b.length)) {
    boards = saved.boards.map(b => b.map(t => ({ ...t, id: newId() })));
    ({ score, won, keepGoing } = saved);
    jammed = saved.jammed ?? [false, false];
  } else {
    newGame();
  }

  // Look for a photo for each level in public/photos, the same files Eddy Merge uses.
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
  const free = tiles => SIZE * SIZE - tiles.filter(t => !t.gone).length;
  const jamText = () => jammed.every(Boolean) ? "Both boards jammed." : `${NAMES[jammed.indexOf(true)]} jammed.`;
</script>

<GameHeader title="Mirror Boards" {score} {best} onnew={newGame}>
  {#snippet goal()}One swipe, two Eddys. Get either to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="pair">
  {#each boards as tiles, i}
    <section class="side" class:mirror={i === 1} class:jam={jammed[i]}>
      <h2>
        <span>{NAMES[i]}{#if i === 1}<span class="flip" aria-hidden="true"> ⇄</span>{/if}</span>
        <small class:low={free(tiles) <= 2}>{free(tiles)} free</small>
      </h2>
      <!-- Only the first board listens for keys, so one key press moves both boards once. -->
      <Board size={SIZE} {tiles} onmove={move} keys={i === 0}>
        {#snippet tile(t)}
          <div class="face" class:dark={t.lvl <= 2} style="background: var(--t{t.lvl})">
            {#if photos[t.lvl]}
              <img src={photos[t.lvl]} alt={t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`} draggable="false" />
              <span class="badge">{t.lvl === MAX ? "Eddy Li (MIT)" : value(t.lvl)}</span>
            {:else if t.lvl === MAX}
              <span class="final">Eddy Li<small>MIT</small></span>
            {:else}
              <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
            {/if}
          </div>
        {/snippet}
      </Board>
    </section>
  {/each}
  {#if won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if over}
    <Overlay title="Game over!">
      <p class="why">{jamText()}</p>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {/if}
</div>

<p class="how">
  <strong>How to play:</strong> Use your arrow keys, or swipe on either board. Both boards move together, but the
  mirror board is flipped, so left and right are swapped on it. Up and down stay the same. If either board fills up
  with no moves left, the game is over.
</p>

<style>
  .pair { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; container-type: inline-size; }
  .side { min-width: 0; }
  h2 { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin: 0 0 6px; font-size: 16px; }
  h2 small { font-size: 13px; font-weight: bold; opacity: 0.8; white-space: nowrap; }
  h2 small.low { color: var(--t6); opacity: 1; }
  .flip { color: var(--t4); }
  .mirror :global(.board) { box-shadow: inset 0 0 0 3px var(--t4); }
  .jam :global(.board) { box-shadow: inset 0 0 0 3px var(--t6); }
  .why { margin: -12px 0 0; width: 100%; font-size: 18px; }
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
    position: absolute; left: 3px; bottom: 3px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 4px; font-size: 4cqw;
  }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 420px) {
    .pair { gap: 8px; }
    h2 { font-size: 14px; }
    h2 small { font-size: 11px; }
  }
</style>
